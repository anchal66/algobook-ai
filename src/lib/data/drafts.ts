import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { DraftSchema, type Draft, type Language } from "@/lib/data/schema";

const COL = "drafts";
export const draftKey = (uid: string, problemId: string) => `${uid}_${problemId}`;

export async function get(uid: string, problemId: string): Promise<Draft | null> {
  const snap = await adminDb.collection(COL).doc(draftKey(uid, problemId)).get();
  return snap.exists ? DraftSchema.parse(snap.data()) : null;
}

/** Upserts the code for one language; other languages' drafts are preserved. */
export async function put(uid: string, problemId: string, language: Language, code: string): Promise<Draft> {
  const ref = adminDb.collection(COL).doc(draftKey(uid, problemId));
  const now = Timestamp.now();
  // `set(..., { merge: true })` deep-merges nested maps; a dotted key would be stored literally (only `update` parses field paths).
  await ref.set({ uid, problemId, language, code: { [language]: code }, updatedAt: now }, { merge: true });
  const snap = await ref.get();
  return DraftSchema.parse(snap.data());
}
