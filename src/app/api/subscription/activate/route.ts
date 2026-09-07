import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { env } from "@/lib/env";
import { getPlan } from "@/lib/plans";
import { getAdminAuth } from "@/lib/firebase-admin";
import { createSubscription, findByGatewayTransaction } from "@/lib/data/subscriptions";
import { setPlanCache } from "@/lib/data/users";

/**
 * Gateway success redirect (no ID token available here). The transaction is
 * re-fetched server-side with the gateway key; `userId`, plan and amount are
 * validated against our own records; activation is idempotent per transaction id.
 */
export async function GET(request: Request) {
  const started = Date.now();
  const tid = new URL(request.url).searchParams.get("tid");
  const redirect = (q: string) => NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/dashboard?payment=${q}`);
  const log = (fields: Record<string, unknown>) => console.info(JSON.stringify({ evt: "subscription.activate", tid, ms: Date.now() - started, ...fields }));

  if (!tid || !/^[\w-]{6,128}$/.test(tid)) { log({ status: "missing_tid" }); return redirect("error&reason=missing_tid"); }

  try {
    const existing = await findByGatewayTransaction(tid);
    if (existing) { log({ status: "already_active", uid: existing.uid }); return redirect("success"); }

    const res = await fetch(`${env.CQ_PAYMENT_GATEWAY_URL}/api/internal/transaction/${encodeURIComponent(tid)}?allowPaid=true`, {
      headers: env.CQ_PAYMENT_GATEWAY_KEY ? { Authorization: `Bearer ${env.CQ_PAYMENT_GATEWAY_KEY}` } : {},
      cache: "no-store",
    });
    if (!res.ok) { log({ status: "invalid_transaction", code: res.status }); return redirect("error&reason=invalid_transaction"); }
    const { transaction } = (await res.json()) as { transaction?: { status?: string; userId?: string; amount?: number; currency?: string; metadata?: { planSlug?: string }; serviceName?: string } };

    if (!transaction || transaction.status !== "PAID") { log({ status: "not_paid" }); return redirect("error&reason=not_paid"); }
    const plan = getPlan(transaction.metadata?.planSlug ?? "");
    if (!plan) { log({ status: "invalid_plan" }); return redirect("error&reason=invalid_plan"); }
    if (typeof transaction.amount === "number" && transaction.amount !== plan.priceInPaise) { log({ status: "amount_mismatch", amount: transaction.amount }); return redirect("error&reason=amount_mismatch"); }
    const uid = transaction.userId ?? "";
    try { await getAdminAuth().getUser(uid); } catch { log({ status: "unknown_user" }); return redirect("error&reason=unknown_user"); }

    const sub = await createSubscription({
      uid, planSlug: plan.slug, planName: plan.name, durationDays: plan.durationDays,
      gatewayTransactionId: tid, amountPaid: transaction.amount ?? plan.priceInPaise, currency: transaction.currency ?? plan.currency,
    });
    await setPlanCache(uid, { slug: "pro", planSlug: plan.slug, status: "active", endDate: sub.endDate, checkedAt: Timestamp.now() }).catch(() => undefined);
    log({ status: "activated", uid, plan: plan.slug });
    return redirect("success");
  } catch (e) {
    console.error(JSON.stringify({ evt: "subscription.activate", level: "error", tid, message: (e as Error).message }));
    return redirect("error&reason=server_error");
  }
}
