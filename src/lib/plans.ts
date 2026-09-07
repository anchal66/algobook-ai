import type { FeatureKey, PlanTier } from "@/lib/data/schema";

export interface Plan {
  slug: string;
  name: string;
  priceInPaise: number;
  currency: string;
  durationDays: number;
  label: string;
  features: string[];
}

/** Purchasable plans (unchanged from v1). */
export const PLANS: Record<string, Plan> = {
  "pro-monthly": {
    slug: "pro-monthly",
    name: "Pro Monthly",
    priceInPaise: 49900,
    currency: "INR",
    durationDays: 30,
    label: "₹499/mo",
    features: [
      "200 AI-generated problems per day",
      "All 4 languages with verified drivers",
      "Level-3 contextual hints, editorials and AI tutor chat",
      "Inline AI code completion",
      "Post-solve AI code review",
      "Mock interview mode",
      "Unlimited projects",
    ],
  },
  "pro-yearly": {
    slug: "pro-yearly",
    name: "Pro Yearly",
    priceInPaise: 499900,
    currency: "INR",
    durationDays: 365,
    label: "₹4,999/yr",
    features: ["Everything in Pro Monthly", "Save 17% compared to monthly", "Full year of uninterrupted access"],
  },
};

export function getPlan(slug: string): Plan | undefined {
  return PLANS[slug];
}

/** Daily limits per plan tier (D-04). -1 = unlimited, 0 = not included. */
export const PLAN_LIMITS: Record<PlanTier, Record<FeatureKey, number>> = {
  free: { generate: 3, run: 30, submit: 50, hint3: 0, editorial: 0, chat: 0, completion: 0, review: 0, interview: 0 },
  pro: { generate: 200, run: 2000, submit: 2000, hint3: 500, editorial: -1, chat: 300, completion: 3000, review: 200, interview: 5 },
};
