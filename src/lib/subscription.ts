import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface Subscription {
  id: string;
  userId: string;
  planSlug: string;
  planName: string;
  status: "active" | "expired";
  startDate: Date;
  endDate: Date;
  gatewayTransactionId: string;
  amountPaid: number;
  currency: string;
  createdAt: Date;
}

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v as string);
}

function docToSubscription(doc: FirebaseFirestore.DocumentSnapshot): Subscription | null {
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    id: doc.id,
    userId: d.userId,
    planSlug: d.planSlug,
    planName: d.planName,
    status: d.status,
    startDate: toDate(d.startDate),
    endDate: toDate(d.endDate),
    gatewayTransactionId: d.gatewayTransactionId,
    amountPaid: d.amountPaid,
    currency: d.currency ?? "INR",
    createdAt: toDate(d.createdAt),
  };
}

export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const now = Timestamp.now();
  const snap = await adminDb
    .collection("subscriptions")
    .where("userId", "==", userId)
    .where("status", "==", "active")
    .where("endDate", ">", now)
    .orderBy("endDate", "desc")
    .limit(1)
    .get();

  if (snap.empty) return null;
  return docToSubscription(snap.docs[0]);
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await getActiveSubscription(userId);
  return sub !== null;
}

export async function createSubscription(data: {
  userId: string;
  planSlug: string;
  planName: string;
  durationDays: number;
  gatewayTransactionId: string;
  amountPaid: number;
  currency: string;
}): Promise<Subscription> {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + data.durationDays);

  const ref = await adminDb.collection("subscriptions").add({
    userId: data.userId,
    planSlug: data.planSlug,
    planName: data.planName,
    status: "active",
    startDate: Timestamp.fromDate(now),
    endDate: Timestamp.fromDate(endDate),
    gatewayTransactionId: data.gatewayTransactionId,
    amountPaid: data.amountPaid,
    currency: data.currency,
    createdAt: FieldValue.serverTimestamp(),
  });

  const doc = await ref.get();
  return docToSubscription(doc)!;
}

export interface SubscriptionStatus {
  active: boolean;
  plan?: { name: string; slug: string } | null;
  startDate?: string;
  endDate?: string;
  reason?: string;
}

export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const sub = await getActiveSubscription(userId);

  if (!sub) {
    return { active: false, reason: "no_active_subscription" };
  }

  return {
    active: true,
    plan: { name: sub.planName, slug: sub.planSlug },
    startDate: sub.startDate.toISOString(),
    endDate: sub.endDate.toISOString(),
  };
}
