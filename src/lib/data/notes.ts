import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { NoteSchema, type Note } from "@/lib/data/schema";

const COL = "notes";
export const noteKey = (uid: string, problemId: string) => `${uid}_${problemId}`;

export async function get(uid: string, problemId: string): Promise<Note | null> {
  const snap = await adminDb.collection(COL).doc(noteKey(uid, problemId)).get();
  return snap.exists ? NoteSchema.parse(snap.data()) : null;
}

export async function put(uid: string, problemId: string, markdown: string): Promise<Note> {
  const doc = NoteSchema.parse({ uid, problemId, markdown, updatedAt: Timestamp.now() });
  await adminDb.collection(COL).doc(noteKey(uid, problemId)).set(doc);
  return doc;
}
