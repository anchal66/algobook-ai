import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { SubscriptionSchema, type Subscription, type WithId } from "@/lib/data/schema";

const COL = "subscriptions";

function parse(snap: FirebaseFirestore.DocumentSnapshot): WithId<Subscription> | null {
  if (!snap.exists) return null;
  return { id: snap.id, ...SubscriptionSchema.parse(snap.data()) };
}

/** Single-field query + in-memory filter: a user has a handful of subscriptions, and this needs no composite index. */
export async function getActiveSubscription(uid: string): Promise<WithId<Subscription> | null> {
  const snap = await adminDb.collection(COL).where("uid", "==", uid).get();
  const now = Date.now();
  let best: WithId<Subscription> | null = null;
  for (const d of snap.docs) {
    const sub = parse(d);
    if (!sub || sub.status !== "active" || sub.endDate.toMillis() <= now) continue;
    if (!best || sub.endDate.toMillis() > best.endDate.toMillis()) best = sub;
  }
  return best;
}

export async function findByGatewayTransaction(gatewayTransactionId: string): Promise<WithId<Subscription> | null> {
  const snap = await adminDb.collection(COL).where("gatewayTransactionId", "==", gatewayTransactionId).limit(1).get();
  return snap.empty ? null : parse(snap.docs[0]);
}

export async function createSubscription(data: {
  uid: string; planSlug: string; planName: string; durationDays: number;
  gatewayTransactionId: string; amountPaid: number; currency: string;
}): Promise<WithId<Subscription>> {
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + data.durationDays);
  const doc = SubscriptionSchema.parse({
    uid: data.uid,
    planSlug: data.planSlug,
    planName: data.planName,
    status: "active",
    startDate: Timestamp.fromDate(now),
    endDate: Timestamp.fromDate(end),
    gatewayTransactionId: data.gatewayTransactionId,
    amountPaid: data.amountPaid,
    currency: data.currency,
    createdAt: Timestamp.fromDate(now),
  });
  const ref = await adminDb.collection(COL).add(doc);
  return { id: ref.id, ...doc };
}
