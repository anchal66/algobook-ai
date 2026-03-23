import { NextResponse } from "next/server";
import { getPlan } from "@/lib/plans";

const GATEWAY_URL = process.env.CQ_PAYMENT_GATEWAY_URL || "http://localhost:3001";
const GATEWAY_KEY = process.env.CQ_PAYMENT_GATEWAY_KEY || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(request: Request) {
  try {
    const { planSlug, userId, userEmail, userName } = await request.json();

    if (!planSlug || !userId || !userEmail) {
      return NextResponse.json(
        { error: "planSlug, userId, and userEmail are required" },
        { status: 400 }
      );
    }

    if (!GATEWAY_KEY) {
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 503 }
      );
    }

    const plan = getPlan(planSlug);
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const res = await fetch(`${GATEWAY_URL}/api/checkout/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GATEWAY_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.priceInPaise,
        currency: plan.currency,
        description: `AlgoBook ${plan.name}`,
        serviceName: "algobook",
        userId,
        userEmail,
        userName: userName || null,
        successUrl: `${APP_URL}/api/subscription/activate`,
        cancelUrl: `${APP_URL}/dashboard?payment=cancelled`,
        metadata: {
          planSlug: plan.slug,
          planName: plan.name,
          durationDays: plan.durationDays,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json(
        { error: err.error || "Failed to create checkout" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ checkoutUrl: data.checkoutUrl });
  } catch (error) {
    console.error("Checkout proxy error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
