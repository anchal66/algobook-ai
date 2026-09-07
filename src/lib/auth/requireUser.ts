import "server-only";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { adminApp } from "@/lib/firebase-admin";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";
import { assertQuota } from "@/lib/auth/quotas";
import type { AuthedUser, PlanInfo } from "@/lib/auth/types";
import { ensureUser, setPlanCache } from "@/lib/data/users";
import { getActiveSubscription } from "@/lib/data/subscriptions";
import type { FeatureKey, User } from "@/lib/data/schema";

const PLAN_CACHE_MS = 5 * 60 * 1000;

export interface RequireUserOptions {
  /** Assert the feature is available on the user's plan and under quota (402/429). */
  feature?: FeatureKey;
  /** Require ADMIN_UIDS membership (403). */
  admin?: boolean;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (!/^bearer$/i.test(scheme) || !token) return null;
  return token.trim();
}

/** Resolve the effective plan, refreshing the 5-minute cache from `subscriptions` when stale. */
export async function resolvePlan(uid: string, doc: User): Promise<PlanInfo> {
  const now = Date.now();
  const cached = doc.plan;
  const fresh = cached?.checkedAt instanceof Timestamp && now - cached.checkedAt.toMillis() < PLAN_CACHE_MS;
  const stillValid = cached?.status === "active" && cached.endDate instanceof Timestamp && cached.endDate.toMillis() > now;

  if (fresh && (cached.status !== "active" || stillValid)) {
    return {
      tier: stillValid ? "pro" : "free",
      planSlug: cached.planSlug,
      status: stillValid ? "active" : cached.status === "active" ? "expired" : cached.status,
      endDate: cached.endDate ? cached.endDate.toDate().toISOString() : null,
    };
  }

  const sub = await getActiveSubscription(uid);
  const plan: PlanInfo = sub
    ? { tier: "pro", planSlug: sub.planSlug, status: "active", endDate: sub.endDate.toDate().toISOString() }
    : { tier: "free", planSlug: cached?.planSlug ?? null, status: cached?.planSlug ? "expired" : "none", endDate: null };
  await setPlanCache(uid, {
    slug: plan.tier,
    planSlug: plan.planSlug,
    status: plan.status,
    endDate: sub ? sub.endDate : null,
    checkedAt: Timestamp.now(),
  });
  return plan;
}

/**
 * Authenticates a request with a Firebase ID token (Module 01 §3.3).
 * Creates `users/{uid}` on first sight, resolves the plan and optional quota.
 */
export async function requireUser(req: Request, opts: RequireUserOptions = {}): Promise<AuthedUser> {
  const token = bearer(req);
  if (!token) throw ApiError.unauthenticated("Missing Authorization: Bearer <Firebase ID token>");

  let decoded;
  try {
    decoded = await getAuth(adminApp).verifyIdToken(token, true);
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    const msg = code === "auth/id-token-revoked" ? "Session revoked, sign in again" : code === "auth/id-token-expired" ? "Session expired" : "Invalid session";
    throw ApiError.unauthenticated(msg);
  }

  const uid = decoded.uid;
  const doc = await ensureUser(uid, {
    email: decoded.email ?? "",
    displayName: (decoded.name as string | undefined) ?? "",
    photoURL: (decoded.picture as string | undefined) ?? "",
  });

  const plan = await resolvePlan(uid, doc);
  const isAdmin = env.adminUids.includes(uid);
  if (opts.admin && !isAdmin) throw ApiError.forbidden("Admin only");

  const user: AuthedUser = { uid, email: decoded.email ?? null, plan, isAdmin, quotas: doc.quotas, doc };
  if (opts.feature) assertQuota(plan.tier, opts.feature, doc.quotas);
  return user;
}

/** Optional auth: returns null instead of throwing when no/invalid token. */
export async function optionalUser(req: Request): Promise<AuthedUser | null> {
  if (!bearer(req)) return null;
  try {
    return await requireUser(req);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}
