import "server-only";
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { DailyChallengeSchema, type DailyChallenge, type WithId } from "@/lib/data/schema";

const COL = "dailyChallenge";

export function ref(date: string) {
  return adminDb.collection(COL).doc(date);
}

export async function get(date: string): Promise<WithId<DailyChallenge> | null> {
  const snap = await ref(date).get();
  return snap.exists ? { id: snap.id, ...DailyChallengeSchema.parse(snap.data()) } : null;
}

/** Creates the day's challenge unless one exists (returns the existing one on a race). */
export async function createIfMissing(date: string, doc: Omit<DailyChallenge, "createdAt" | "solvers" | "date">): Promise<{ challenge: WithId<DailyChallenge>; created: boolean }> {
  const parsed = DailyChallengeSchema.parse({ ...doc, date, solvers: 0, createdAt: Timestamp.now() });
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref(date));
    if (snap.exists) return { challenge: { id: snap.id, ...DailyChallengeSchema.parse(snap.data()) }, created: false };
    tx.set(ref(date), parsed);
    return { challenge: { id: date, ...parsed }, created: true };
  });
}

export function recordSolveInTx(tx: FirebaseFirestore.Transaction, date: string): void {
  tx.set(ref(date), { solvers: FieldValue.increment(1) }, { merge: true });
}

/** Problem ids used as a daily challenge in [from, to] (document-id range — no index needed). */
export async function usedProblemIds(from: string, to: string): Promise<string[]> {
  const snap = await adminDb.collection(COL).where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", to).select("problemId").get();
  return snap.docs.map((d) => d.data().problemId as string).filter(Boolean);
}

export async function listRange(from: string, to: string): Promise<WithId<DailyChallenge>[]> {
  const snap = await adminDb.collection(COL).where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", to).get();
  return snap.docs.map((d) => ({ id: d.id, ...DailyChallengeSchema.parse(d.data()) })).sort((a, b) => (a.id < b.id ? 1 : -1));
}
