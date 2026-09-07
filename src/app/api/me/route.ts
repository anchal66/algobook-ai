import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { PLAN_LIMITS } from "@/lib/plans";
import { effectiveQuotas, nextUtcMidnight } from "@/lib/auth/quotas";
import { getUser, ownProfile, updateProfileFields } from "@/lib/data/users";
import { ExperienceLevelSchema, GoalTypeSchema, serialize } from "@/lib/data/schema";
import type { AuthedUser } from "@/lib/auth/types";
import { adminDb, getAdminAuth } from "@/lib/firebase-admin";
import * as projects from "@/lib/data/projects";

export function meResponse(user: AuthedUser, doc = user.doc) {
  const q = effectiveQuotas(doc.quotas);
  const { date: _d, ...used } = q;
  return {
    user: serialize({ uid: user.uid, ...ownProfile(doc) }),
    plan: user.plan,
    isAdmin: user.isAdmin,
    quotas: { date: q.date, used, limits: PLAN_LIMITS[user.plan.tier], resetAt: nextUtcMidnight().toISOString() },
  };
}

export const GET = handler({ evt: "me.get" }, async ({ user }) => meResponse(user));

const PatchSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  bio: z.string().max(300).optional(),
  company: z.string().max(80).optional(),
  college: z.string().max(120).optional(),
  location: z.string().max(80).optional(),
  githubUrl: z.union([z.url(), z.literal("")]).optional(),
  linkedinUrl: z.union([z.url(), z.literal("")]).optional(),
  skills: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  experienceLevel: ExperienceLevelSchema.optional(),
  goalType: GoalTypeSchema.optional(),
  publicProfile: z.boolean().optional(),
});

export const PATCH = handler({ evt: "me.patch", body: PatchSchema }, async ({ user, body }) => {
  await updateProfileFields(user.uid, body);
  const doc = (await getUser(user.uid))!;
  return meResponse(user, doc);
});

async function deleteWhere(col: string, field: string, value: string): Promise<number> {
  let n = 0;
  for (;;) {
    const snap = await adminDb.collection(col).where(field, "==", value).limit(400).get();
    if (snap.empty) return n;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    n += snap.size;
    if (snap.size < 400) return n;
  }
}

/**
 * `DELETE /api/me` (Module 05 U-19 danger zone): removes the user's documents — projects (recursively), submissions,
 * drafts, notes, activity, interviews, achievements, the username lock and the user doc — then the Auth account.
 * The `subscriptions` ledger is kept for accounting (D-02 rationale).
 */
export const DELETE = handler({ evt: "me.delete" }, async ({ user }) => {
  const uid = user.uid;
  const projectIds = await projects.idsForUser(uid);
  for (const id of projectIds) await adminDb.recursiveDelete(adminDb.collection("projects").doc(id));
  const counts: Record<string, number> = {};
  for (const col of ["submissions", "drafts", "notes", "activity", "interviews", "reports"]) counts[col] = await deleteWhere(col, "uid", uid);
  await adminDb.collection("achievements").doc(uid).delete().catch(() => undefined);
  if (user.doc.username) await adminDb.collection("usernames").doc(user.doc.username).delete().catch(() => undefined);
  await adminDb.collection("users").doc(uid).delete();
  await getAdminAuth().deleteUser(uid).catch(() => undefined);
  return { ok: true as const, deleted: { projects: projectIds.length, ...counts } };
});
