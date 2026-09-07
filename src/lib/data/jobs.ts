import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { PregenJobSchema, type PregenJob, type WithId } from "@/lib/data/schema";

const COL = "jobs";

export async function createPregenJob(id: string, job: Omit<PregenJob, "createdAt" | "updatedAt" | "type">): Promise<WithId<PregenJob>> {
  const now = Timestamp.now();
  const doc = PregenJobSchema.parse({ ...job, type: "pregen", createdAt: now, updatedAt: now });
  await adminDb.collection(COL).doc(id).set(doc);
  return { id, ...doc };
}

export async function getPregenJob(id: string): Promise<WithId<PregenJob> | null> {
  const snap = await adminDb.collection(COL).doc(id).get();
  return snap.exists ? { id: snap.id, ...PregenJobSchema.parse(snap.data()) } : null;
}

export async function updatePregenJob(id: string, patch: Partial<Pick<PregenJob, "status" | "outputFileId" | "results" | "error" | "cursor">>): Promise<void> {
  await adminDb.collection(COL).doc(id).update({ ...patch, updatedAt: Timestamp.now() });
}

/** Open pregen jobs (submitted or collecting), oldest first. */
export async function listOpenPregenJobs(limit = 10): Promise<WithId<PregenJob>[]> {
  const snap = await adminDb.collection(COL).where("type", "==", "pregen").where("status", "in", ["submitted", "collecting"]).limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...PregenJobSchema.parse(d.data()) })).sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

export async function listRecentPregenJobs(limit = 10): Promise<WithId<PregenJob>[]> {
  const snap = await adminDb.collection(COL).where("type", "==", "pregen").limit(50).get();
  return snap.docs.map((d) => ({ id: d.id, ...PregenJobSchema.parse(d.data()) })).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()).slice(0, limit);
}
