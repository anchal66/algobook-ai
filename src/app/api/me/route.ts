import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { PLAN_LIMITS } from "@/lib/plans";
import { effectiveQuotas, nextUtcMidnight } from "@/lib/auth/quotas";
import { getUser, ownProfile, updateProfileFields } from "@/lib/data/users";
import { ExperienceLevelSchema, GoalTypeSchema, serialize } from "@/lib/data/schema";
import type { AuthedUser } from "@/lib/auth/types";

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
});

export const PATCH = handler({ evt: "me.patch", body: PatchSchema }, async ({ user, body }) => {
  await updateProfileFields(user.uid, body);
  const doc = (await getUser(user.uid))!;
  return meResponse(user, doc);
});
