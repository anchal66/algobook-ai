import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.CQ_PAYMENT_GATEWAY_URL || "http://localhost:3001";
const API_KEY = process.env.CQ_PAYMENT_API_KEY || "";
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

    if (!API_KEY) {
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 503 }
      );
    }

    const res = await fetch(`${GATEWAY_URL}/api/checkout/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planSlug,
        userId,
        userEmail,
        userName: userName || null,
        successUrl: `${APP_URL}/dashboard?payment=success`,
        cancelUrl: `${APP_URL}/dashboard?payment=cancelled`,
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
