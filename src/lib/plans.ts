export interface Plan {
  slug: string;
  name: string;
  priceInPaise: number;
  currency: string;
  durationDays: number;
  label: string;
  features: string[];
}

export const PLANS: Record<string, Plan> = {
  "pro-monthly": {
    slug: "pro-monthly",
    name: "Pro Monthly",
    priceInPaise: 49900,
    currency: "INR",
    durationDays: 30,
    label: "₹499/mo",
    features: [
      "Unlimited AI-generated questions",
      "Smart question recommendations",
      "Progressive AI hints",
      "Full code editor & execution",
      "Performance tracking & mastery scores",
      "Interview prep mode",
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
    features: [
      "Everything in Pro Monthly",
      "Save 17% compared to monthly",
      "Full year of uninterrupted access",
    ],
  },
};

export function getPlan(slug: string): Plan | undefined {
  return PLANS[slug];
}
