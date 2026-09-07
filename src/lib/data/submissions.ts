import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { SubmissionSchema, type Submission, type WithId } from "@/lib/data/schema";

const COL = "submissions";

export function parse(snap: FirebaseFirestore.DocumentSnapshot): WithId<Submission> | null {
  if (!snap.exists) return null;
  return { id: snap.id, ...SubmissionSchema.parse(snap.data()) };
}

export function newRef() {
  return adminDb.collection(COL).doc();
}

export async function get(id: string, uid: string): Promise<WithId<Submission> | null> {
  const s = parse(await adminDb.collection(COL).doc(id).get());
  return s && s.uid === uid ? s : null;
}

export interface ListOptions { problemId?: string; projectId?: string; limit?: number; cursor?: string }

/** Cursor-paginated (createdAt desc). Code is omitted from list rows. */
export async function list(uid: string, opts: ListOptions = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  let q: FirebaseFirestore.Query = adminDb.collection(COL).where("uid", "==", uid);
  if (opts.problemId) q = q.where("problemId", "==", opts.problemId);
  if (opts.projectId) q = q.where("projectId", "==", opts.projectId);
  q = q.orderBy("createdAt", "desc");
  if (opts.cursor) {
    const cur = await adminDb.collection(COL).doc(opts.cursor).get();
    if (cur.exists && cur.data()?.uid === uid) q = q.startAfter(cur);
  }
  const snap = await q.limit(limit + 1).get();
  const docs = snap.docs.slice(0, limit);
  const items = docs.map((d) => {
    const { code: _code, ...rest } = parse(d)!;
    return rest;
  });
  return { items, nextCursor: snap.docs.length > limit ? docs[docs.length - 1].id : null };
}

export async function countForProblem(uid: string, problemId: string): Promise<number> {
  const agg = await adminDb.collection(COL).where("uid", "==", uid).where("problemId", "==", problemId).count().get();
  return agg.data().count;
}

export async function hasAccepted(uid: string, problemId: string): Promise<boolean> {
  const snap = await adminDb.collection(COL).where("uid", "==", uid).where("problemId", "==", problemId).where("verdict", "==", "AC").limit(1).get();
  return !snap.empty;
}
