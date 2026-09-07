import { handler } from "@/lib/api/handler";
import { adminDb } from "@/lib/firebase-admin";
import { SubscriptionSchema } from "@/lib/data/schema";

/** `GET /api/subscription/invoices` (Module 05 U-19): the user's subscription ledger, newest first. */
export const GET = handler({ evt: "subscription.invoices" }, async ({ user }) => {
  const snap = await adminDb.collection("subscriptions").where("uid", "==", user.uid).get();
  const invoices = snap.docs.map((d) => {
    const s = SubscriptionSchema.parse(d.data());
    return {
      id: d.id, planSlug: s.planSlug, planName: s.planName, status: s.status, amountInPaise: s.amountPaid, currency: s.currency,
      createdAt: s.createdAt.toDate().toISOString(), startDate: s.startDate.toDate().toISOString(), endDate: s.endDate.toDate().toISOString(),
      gatewayTransactionId: s.gatewayTransactionId,
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { invoices };
});
