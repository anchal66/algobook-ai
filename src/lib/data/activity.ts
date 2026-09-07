import "server-only";
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ActivitySchema, type Activity, type WithId } from "@/lib/data/schema";

const COL = "activity";
export const activityKey = (uid: string, date: string) => `${uid}_${date}`;

export interface ActivityDelta {
  submissions?: number;
  accepted?: number;
  problemSolved?: string; // added to problemsSolved (arrayUnion)
  timeSpentSec?: number;
  runs?: number;
  xpEarned?: number;
  /** Module 04: project touched that day (arrayUnion) — `projects.progress.activeDays` source. */
  projectId?: string;
  /** Module 04: today's daily challenge was solved (set once). */
  dailySolved?: boolean;
}

export function ref(uid: string, date: string) {
  return adminDb.collection(COL).doc(activityKey(uid, date));
}

/** Upsert inside an existing transaction (set with merge so a missing doc is created). */
export function recordInTx(tx: FirebaseFirestore.Transaction, uid: string, date: string, delta: ActivityDelta): void {
  const data: Record<string, unknown> = { uid, date, updatedAt: Timestamp.now() };
  if (delta.submissions) data.submissions = FieldValue.increment(delta.submissions);
  if (delta.accepted) data.accepted = FieldValue.increment(delta.accepted);
  if (delta.timeSpentSec) data.timeSpentSec = FieldValue.increment(delta.timeSpentSec);
  if (delta.runs) data.runs = FieldValue.increment(delta.runs);
  if (delta.xpEarned) data.xpEarned = FieldValue.increment(delta.xpEarned);
  if (delta.problemSolved) data.problemsSolved = FieldValue.arrayUnion(delta.problemSolved);
  if (delta.projectId) data.projectIds = FieldValue.arrayUnion(delta.projectId);
  if (delta.dailySolved) data.dailySolved = true;
  tx.set(ref(uid, date), data, { merge: true });
}

/** Activity docs for a date range (inclusive) across all users — leaderboard weekly snapshot. Single-field range on `date`. */
export async function listRange(from: string, to: string, limit = 20_000): Promise<WithId<Activity>[]> {
  const snap = await adminDb.collection(COL).where("date", ">=", from).where("date", "<=", to).limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...ActivitySchema.parse(d.data()) }));
}

export async function getDay(uid: string, date: string): Promise<WithId<Activity> | null> {
  const snap = await ref(uid, date).get();
  return snap.exists ? { id: snap.id, ...ActivitySchema.parse(snap.data()) } : null;
}

/** Standalone upsert (used by /api/run). */
export async function recordSubmit(uid: string, date: string, delta: ActivityDelta): Promise<void> {
  await adminDb.runTransaction(async (tx) => recordInTx(tx, uid, date, delta));
}

export async function listYear(uid: string, year: number): Promise<WithId<Activity>[]> {
  // Doc ids are `${uid}_${date}`, so a document-id range needs no composite index.
  const snap = await adminDb.collection(COL)
    .where(FieldPath.documentId(), ">=", activityKey(uid, `${year}-01-01`))
    .where(FieldPath.documentId(), "<=", activityKey(uid, `${year}-12-31`))
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...ActivitySchema.parse(d.data()) }));
}
