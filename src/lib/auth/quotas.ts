/**
 * Per-plan daily quotas (Module 01 §3.4). Counters live in `users/{uid}.quotas`
 * as `{ date: "YYYY-MM-DD", [feature]: n }` and reset when the UTC date changes.
 * The pure helpers are unit-tested; the Firestore helpers wrap them.
 */
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/api/errors";
import { PLAN_LIMITS } from "@/lib/plans";
import { QuotasSchema, todayKey, type FeatureKey, type PlanTier, type Quotas } from "@/lib/data/schema";

export interface QuotaCheck {
  ok: boolean;
  /** Why not ok: feature is not in the plan (402) or the daily limit is hit (429). */
  reason?: "not_in_plan" | "exhausted";
  limit: number;
  used: number;
  remaining: number; // Infinity when unlimited
  resetAt: string; // ISO of next UTC midnight
}

export function nextUtcMidnight(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return d;
}

/** Counters valid for `now`; a stale date means every counter is 0. */
export function effectiveQuotas(quotas: Partial<Quotas> | undefined, now: Date = new Date()): Quotas {
  const today = todayKey(now);
  const base = QuotasSchema.parse(quotas ?? {});
  if (base.date !== today) return { ...QuotasSchema.parse({}), date: today };
  return base;
}

export function checkQuota(tier: PlanTier, feature: FeatureKey, quotas: Partial<Quotas> | undefined, now: Date = new Date()): QuotaCheck {
  const limit = PLAN_LIMITS[tier][feature];
  const eff = effectiveQuotas(quotas, now);
  const used = eff[feature] ?? 0;
  const resetAt = nextUtcMidnight(now).toISOString();
  if (limit === 0) return { ok: false, reason: "not_in_plan", limit, used, remaining: 0, resetAt };
  if (limit < 0) return { ok: true, limit, used, remaining: Infinity, resetAt };
  if (used >= limit) return { ok: false, reason: "exhausted", limit, used, remaining: 0, resetAt };
  return { ok: true, limit, used, remaining: limit - used, resetAt };
}

/** Pure counterpart of consumeQuota: returns the updated counters. */
export function applyConsume(quotas: Partial<Quotas> | undefined, feature: FeatureKey, now: Date = new Date(), amount = 1): Quotas {
  const eff = effectiveQuotas(quotas, now);
  return { ...eff, [feature]: (eff[feature] ?? 0) + amount };
}

/** Throws 402 / 429 when the feature is not available right now. */
export function assertQuota(tier: PlanTier, feature: FeatureKey, quotas: Partial<Quotas> | undefined, now: Date = new Date()): QuotaCheck {
  const check = checkQuota(tier, feature, quotas, now);
  if (check.ok) return check;
  if (check.reason === "not_in_plan") throw ApiError.paymentRequired(`"${feature}" is not included in the ${tier} plan`);
  throw ApiError.quotaExceeded(check.resetAt, `Daily ${feature} limit (${check.limit}) reached`);
}

/**
 * Increments the counter after a successful action. Runs in a transaction so
 * concurrent requests cannot lose increments; resets the date if it changed.
 */
export async function consumeQuota(uid: string, feature: FeatureKey, amount = 1): Promise<Quotas> {
  const ref = adminDb.collection("users").doc(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.data()?.quotas ?? {}) as Partial<Quotas>;
    const today = todayKey();
    if (current.date !== today) {
      const fresh = applyConsume(undefined, feature, new Date(), amount);
      tx.update(ref, { quotas: fresh, updatedAt: FieldValue.serverTimestamp() });
      return fresh;
    }
    tx.update(ref, { [`quotas.${feature}`]: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() });
    return applyConsume(current, feature, new Date(), amount);
  });
}

/** Same as consumeQuota but inside the caller's transaction; `userData` must come from a tx.get on the same ref. */
export function consumeQuotaInTx(tx: FirebaseFirestore.Transaction, userRef: FirebaseFirestore.DocumentReference, userData: FirebaseFirestore.DocumentData, feature: FeatureKey, amount = 1): void {
  const current = (userData.quotas ?? {}) as Partial<Quotas>;
  if (current.date !== todayKey()) {
    tx.update(userRef, { quotas: applyConsume(undefined, feature, new Date(), amount) });
  } else {
    tx.update(userRef, { [`quotas.${feature}`]: FieldValue.increment(amount) });
  }
}
