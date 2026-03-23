import { checkSubscriptionStatus, type SubscriptionStatus } from "@/lib/subscription";

export type { SubscriptionStatus };

export async function checkSubscription(userId: string): Promise<SubscriptionStatus> {
  return checkSubscriptionStatus(userId);
}
