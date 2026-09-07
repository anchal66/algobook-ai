import "server-only";
/**
 * Global daily Judge0 budget (D-05). The RapidAPI free tier allows ~50 batched submissions per day for the whole
 * app; every Run/Submit/verification is at least one batch. `system/judge` counts batches per UTC day in a
 * transaction so one user cannot silently exhaust the day for everyone, and the error users see is honest.
 * `JUDGE0_DAILY_CAP=0` disables the cap (self-hosted / paid plans).
 */
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { todayKey } from "@/lib/data/schema";

export const JUDGE_BUSY_MESSAGE = "Code execution is at capacity for today — it resets at 00:00 UTC. You can keep editing; drafts are saved.";
const REF = () => adminDb.collection("system").doc("judge");

/** Effective cap: env override, else 45 on the RapidAPI free tier, else unlimited. */
export function dailyCap(): number {
  if (typeof env.JUDGE0_DAILY_CAP === "number") return env.JUDGE0_DAILY_CAP;
  const onRapid = !env.JUDGE0_AUTH_TOKEN && /rapidapi/.test(env.JUDGE0_HOST_HEADER ?? "");
  return onRapid ? 45 : 0;
}

/** Reserves one batch; throws 503 UPSTREAM when the day's budget is spent. */
export async function reserveBatch(): Promise<{ used: number; cap: number }> {
  const cap = dailyCap();
  const today = todayKey();
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(REF());
    const d = snap.data() ?? {};
    const used = d.date === today ? Number(d.batches ?? 0) : 0;
    if (cap > 0 && used >= cap) throw new ApiError(503, "UPSTREAM", JUDGE_BUSY_MESSAGE, { code: "JUDGE_BUDGET", used, cap });
    if (d.date === today) tx.update(REF(), { batches: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    else tx.set(REF(), { date: today, batches: 1, updatedAt: FieldValue.serverTimestamp() });
    return { used: used + 1, cap };
  });
}

export async function budgetStatus(): Promise<{ date: string; used: number; cap: number }> {
  const snap = await REF().get();
  const d = snap.data() ?? {};
  const today = todayKey();
  return { date: today, used: d.date === today ? Number(d.batches ?? 0) : 0, cap: dailyCap() };
}
