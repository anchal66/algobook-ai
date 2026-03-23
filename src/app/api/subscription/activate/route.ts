import { NextResponse } from "next/server";
import { createSubscription } from "@/lib/subscription";
import { getPlan } from "@/lib/plans";

const GATEWAY_URL = process.env.CQ_PAYMENT_GATEWAY_URL || "http://localhost:3001";
const GATEWAY_KEY = process.env.CQ_PAYMENT_GATEWAY_KEY || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get("tid");

  if (!transactionId) {
    return NextResponse.redirect(`${APP_URL}/dashboard?payment=error&reason=missing_tid`);
  }

  try {
    const res = await fetch(
      `${GATEWAY_URL}/api/internal/transaction/${transactionId}?allowPaid=true`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      return NextResponse.redirect(`${APP_URL}/dashboard?payment=error&reason=invalid_transaction`);
    }

    const { transaction } = await res.json();

    if (!transaction || transaction.status !== "PAID") {
      return NextResponse.redirect(`${APP_URL}/dashboard?payment=error&reason=not_paid`);
    }

    const metadata = transaction.metadata || {};
    const planSlug = metadata.planSlug as string;
    const plan = getPlan(planSlug);

    if (!plan) {
      return NextResponse.redirect(`${APP_URL}/dashboard?payment=error&reason=invalid_plan`);
    }

    await createSubscription({
      userId: transaction.userId,
      planSlug: plan.slug,
      planName: plan.name,
      durationDays: plan.durationDays,
      gatewayTransactionId: transactionId,
      amountPaid: transaction.amount,
      currency: transaction.currency,
    });

    return NextResponse.redirect(`${APP_URL}/dashboard?payment=success`);
  } catch (error) {
    console.error("Subscription activation error:", error);
    return NextResponse.redirect(`${APP_URL}/dashboard?payment=error&reason=server_error`);
  }
}
