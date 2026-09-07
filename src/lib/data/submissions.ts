import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { FALLBACK_SCAN_LIMIT, isMissingIndexError, onMissingIndex } from "@/lib/data/_firestore";
import { Timestamp } from "firebase-admin/firestore";
import { SubmissionSchema, StoredReviewSchema, type Review, type StoredReview, type Submission, type WithId } from "@/lib/data/schema";

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

type Row = Omit<WithId<Submission>, "code">;

const stripCode = (s: WithId<Submission>): Row => {
  const { code: _code, ...rest } = s;
  return rest;
};

function baseQuery(uid: string, opts: ListOptions): FirebaseFirestore.Query {
  let q: FirebaseFirestore.Query = adminDb.collection(COL).where("uid", "==", uid);
  if (opts.problemId) q = q.where("problemId", "==", opts.problemId);
  if (opts.projectId) q = q.where("projectId", "==", opts.projectId);
  return q;
}

/**
 * Equality-only scan sorted in memory. Used when `submissions(uid, createdAt desc)`
 * has not been deployed yet; correct but reads the user's whole history.
 */
async function listWithoutIndex(uid: string, opts: ListOptions, limit: number) {
  onMissingIndex("submissions(uid, createdAt desc)");
  const snap = await baseQuery(uid, opts).limit(FALLBACK_SCAN_LIMIT).get();
  const all = snap.docs
    .map((d) => parse(d)!)
    .filter(Boolean)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  const start = opts.cursor ? all.findIndex((s) => s.id === opts.cursor) + 1 : 0;
  const page = all.slice(start, start + limit);
  const hasMore = all.length > start + limit;
  return { items: page.map(stripCode), nextCursor: hasMore && page.length ? page[page.length - 1].id : null };
}

/** Cursor-paginated (createdAt desc). Code is omitted from list rows. */
export async function list(uid: string, opts: ListOptions = {}): Promise<{ items: Row[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  let q = baseQuery(uid, opts).orderBy("createdAt", "desc");
  if (opts.cursor) {
    const cur = await adminDb.collection(COL).doc(opts.cursor).get();
    if (cur.exists && cur.data()?.uid === uid) q = q.startAfter(cur);
  }
  try {
    const snap = await q.limit(limit + 1).get();
    const docs = snap.docs.slice(0, limit);
    return {
      items: docs.map((d) => stripCode(parse(d)!)),
      nextCursor: snap.docs.length > limit ? docs[docs.length - 1].id : null,
    };
  } catch (e) {
    if (!isMissingIndexError(e)) throw e;
    return listWithoutIndex(uid, opts, limit);
  }
}

export async function countForProblem(uid: string, problemId: string): Promise<number> {
  const agg = await adminDb.collection(COL).where("uid", "==", uid).where("problemId", "==", problemId).count().get();
  return agg.data().count;
}

export async function hasAccepted(uid: string, problemId: string): Promise<boolean> {
  const snap = await adminDb.collection(COL).where("uid", "==", uid).where("problemId", "==", problemId).where("verdict", "==", "AC").limit(1).get();
  return !snap.empty;
}

/** Distinct problem ids the user has an accepted submission for (capped scan; equality-only query, no composite index). */
export async function acceptedProblemIds(uid: string, cap = 1000): Promise<string[]> {
  const snap = await adminDb.collection(COL).where("uid", "==", uid).where("verdict", "==", "AC").select("problemId").limit(cap).get();
  return [...new Set(snap.docs.map((d) => d.data().problemId as string))];
}

/** Stores the post-AC AI review on the submission (Module 02 A-11). */
export async function setReview(id: string, review: Review, model: string): Promise<StoredReview> {
  const doc = StoredReviewSchema.parse({ ...review, model, createdAt: Timestamp.now() });
  await adminDb.collection(COL).doc(id).update({ review: doc });
  return doc;
}
