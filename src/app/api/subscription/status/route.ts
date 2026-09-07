import { handler } from "@/lib/api/handler";
import { getPlan } from "@/lib/plans";

/** Current user's plan (the server derives the uid from the token). */
export const GET = handler({ evt: "subscription.status" }, async ({ user }) => {
  const plan = user.plan.planSlug ? getPlan(user.plan.planSlug) : undefined;
  return {
    active: user.plan.tier === "pro",
    tier: user.plan.tier,
    status: user.plan.status,
    plan: plan ? { name: plan.name, slug: plan.slug } : null,
    endDate: user.plan.endDate,
  };
});
