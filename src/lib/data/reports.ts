import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ReportSchema, type Report, type ReportReason } from "@/lib/data/schema";

const COL = "reports";

export async function create(input: { problemId: string; uid: string; reason: ReportReason; details?: string | null }): Promise<Report & { id: string }> {
  const doc = ReportSchema.parse({ ...input, details: input.details ?? null, createdAt: Timestamp.now() });
  const ref = await adminDb.collection(COL).add(doc);
  return { id: ref.id, ...doc };
}

export async function existsForUser(problemId: string, uid: string): Promise<boolean> {
  const snap = await adminDb.collection(COL).where("problemId", "==", problemId).where("uid", "==", uid).limit(1).get();
  return !snap.empty;
}
