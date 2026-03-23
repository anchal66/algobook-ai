const GATEWAY_URL = process.env.CQ_PAYMENT_GATEWAY_URL || "http://localhost:3001";
const API_KEY = process.env.CQ_PAYMENT_API_KEY || "";

export interface SubscriptionStatus {
  active: boolean;
  status?: string;
  plan?: { name: string; slug: string; interval: string } | null;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  reason?: string;
}

export async function checkSubscription(userId: string): Promise<SubscriptionStatus> {
  if (!API_KEY) {
    console.warn("CQ_PAYMENT_API_KEY not set — treating user as unsubscribed");
    return { active: false, reason: "gateway_not_configured" };
  }

  try {
    const res = await fetch(
      `${GATEWAY_URL}/api/subscriptions/check?userId=${encodeURIComponent(userId)}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.error("Subscription check failed:", res.status);
      return { active: false, reason: "gateway_error" };
    }

    return await res.json();
  } catch (error) {
    console.error("Subscription check error:", error);
    return { active: false, reason: "gateway_unreachable" };
  }
}
