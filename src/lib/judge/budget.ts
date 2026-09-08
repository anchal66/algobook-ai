import "server-only";
/**
 * Global daily Judge0 budget (D-05). The RapidAPI free tier allows ~50 batched submissions per day for the whole
 * app; every Run/Submit/verification is at least one batch. `system/judge` counts batches per UTC day in a
 * transaction so one user — or a background job — cannot silently exhaust the day for everyone.
 *
 * Two priorities:
 *  - `user`   Run, Submit and the verification of a problem someone is waiting for. May spend the whole budget.
 *  - `background`  driver fan-out and pre-generation. Refused once the budget drops to `USER_RESERVE`, so a
 *    batch of generations can never leave real users unable to run their code. Refusal is not an error for
 *    the caller: the language is simply generated on demand later (`ensureLanguage`).
 *
 * `JUDGE0_DAILY_CAP=0` disables the cap entirely (self-hosted or a paid plan).
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { todayKey } from "@/lib/data/schema";

export type BatchPriority = "user" | "background";

export const JUDGE_BUSY_MESSAGE = "Code execution is at capacity for today — it resets at 00:00 UTC. You can keep editing; drafts are saved.";
/** Batches kept aside for people actually solving problems. */
export const USER_RESERVE = 15;

const REF = () => adminDb.collection("system").doc("judge");
const priorityStore = new AsyncLocalStorage<BatchPriority>();

/** Runs `fn` with every judge batch inside it marked `background` (fan-out, pre-generation). */
export function asBackground<T>(fn: () => Promise<T>): Promise<T> {
  return priorityStore.run("background", fn);
}

export function currentPriority(): BatchPriority {
  return priorityStore.getStore() ?? "user";
}

/** Effective cap: env override, else 45 on the RapidAPI free tier, else unlimited. */
export function dailyCap(): number {
  if (typeof env.JUDGE0_DAILY_CAP === "number") return env.JUDGE0_DAILY_CAP;
  const onRapid = !env.JUDGE0_AUTH_TOKEN && /rapidapi/.test(env.JUDGE0_HOST_HEADER ?? "");
  return onRapid ? 45 : 0;
}

/** Thrown instead of a 503 when a *background* job is refused; callers treat it as "skip, do it later". */
export class BudgetSkipped extends Error {
  constructor(public readonly used: number, public readonly cap: number) {
    super(`Judge budget reserved for users (${used}/${cap})`);
    this.name = "BudgetSkipped";
  }
}

/** Reserves one batch. Throws `BudgetSkipped` for background work near the floor, 503 for users at the cap. */
export async function reserveBatch(priority: BatchPriority = currentPriority()): Promise<{ used: number; cap: number }> {
  const cap = dailyCap();
  const today = todayKey();
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(REF());
    const d = snap.data() ?? {};
    const used = d.date === today ? Number(d.batches ?? 0) : 0;
    if (cap > 0) {
      const limit = priority === "background" ? Math.max(0, cap - USER_RESERVE) : cap;
      if (used >= limit) {
        if (priority === "background") throw new BudgetSkipped(used, cap);
        throw new ApiError(503, "UPSTREAM", JUDGE_BUSY_MESSAGE, { code: "JUDGE_BUDGET", used, cap });
      }
    }
    if (d.date === today) tx.update(REF(), { batches: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    else tx.set(REF(), { date: today, batches: 1, updatedAt: FieldValue.serverTimestamp() });
    return { used: used + 1, cap };
  });
}

export interface BudgetStatus { date: string; used: number; cap: number; remaining: number; backgroundRemaining: number; reserve: number }

export async function budgetStatus(): Promise<BudgetStatus> {
  const snap = await REF().get();
  const d = snap.data() ?? {};
  const today = todayKey();
  const cap = dailyCap();
  const used = d.date === today ? Number(d.batches ?? 0) : 0;
  return {
    date: today, used, cap, reserve: USER_RESERVE,
    remaining: cap > 0 ? Math.max(0, cap - used) : Infinity,
    backgroundRemaining: cap > 0 ? Math.max(0, cap - USER_RESERVE - used) : Infinity,
  };
}

/** True when background work (fan-out, pregen) should run at all right now. */
export async function hasBackgroundBudget(): Promise<boolean> {
  const s = await budgetStatus();
  return s.backgroundRemaining > 0;
}
