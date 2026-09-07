import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { getPlan } from "@/lib/plans";

export const POST = handler({ evt: "subscription.checkout", body: z.object({ planSlug: z.string() }) }, async ({ user, body }) => {
  const plan = getPlan(body.planSlug);
  if (!plan) throw ApiError.validation("Invalid plan");
  if (!env.CQ_PAYMENT_GATEWAY_KEY) throw new ApiError(503, "UPSTREAM", "Payment gateway not configured");
  if (!user.email) throw ApiError.validation("Your account has no email address");

  const res = await fetch(`${env.CQ_PAYMENT_GATEWAY_URL}/api/checkout/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CQ_PAYMENT_GATEWAY_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: plan.priceInPaise,
      currency: plan.currency,
      description: `AlgoBook ${plan.name}`,
      serviceName: "algobook",
      userId: user.uid,
      userEmail: user.email,
      userName: user.doc.displayName || null,
      successUrl: `${env.NEXT_PUBLIC_APP_URL}/api/subscription/activate`,
      cancelUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard?payment=cancelled`,
      metadata: { planSlug: plan.slug, planName: plan.name, durationDays: plan.durationDays },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw ApiError.upstream((err as { error?: string }).error || "Failed to create checkout");
  }
  const data = (await res.json()) as { checkoutUrl?: string };
  if (!data.checkoutUrl) throw ApiError.upstream("Gateway returned no checkout URL");
  return { checkoutUrl: data.checkoutUrl };
});
