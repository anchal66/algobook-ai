import type { FeatureKey, PlanTier, Quotas, User } from "@/lib/data/schema";

export interface PlanInfo {
  tier: PlanTier;
  planSlug: string | null;
  status: "none" | "active" | "expired";
  endDate: string | null; // ISO
}

export interface AuthedUser {
  uid: string;
  email: string | null;
  plan: PlanInfo;
  isAdmin: boolean;
  quotas: Quotas;
  /** The full users/{uid} document (server shape). */
  doc: User;
}

/** Wire shape of /api/me. */
export interface AuthedUserDTO {
  uid: string;
  email: string | null;
  plan: PlanInfo;
  isAdmin: boolean;
  quotas: { date: string; used: Partial<Record<FeatureKey, number>>; limits: Record<FeatureKey, number>; resetAt: string };
}
