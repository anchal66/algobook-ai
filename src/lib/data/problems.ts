import "server-only";
import { FieldValue, Timestamp, FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  ProblemSchema, ProblemPrivateTestsSchema, ProblemPrivateDriversSchema,
  type Difficulty, type Language, type Problem, type ProblemPrivateDrivers, type ProblemPrivateTests, type ProblemStatus, type WithId,
} from "@/lib/data/schema";

const COL = "problems";

export type ProblemPublic = Omit<WithId<Problem>, "embedding">;

function stripPrivate(id: string, data: FirebaseFirestore.DocumentData): ProblemPublic {
  const parsed = ProblemSchema.parse(data);
  const { embedding: _e, ...rest } = parsed;
  return { id, ...rest };
}

export async function getPublic(id: string): Promise<ProblemPublic | null> {
  const snap = await adminDb.collection(COL).doc(id).get();
  if (!snap.exists) return null;
  return stripPrivate(snap.id, snap.data()!);
}

export async function getBySlug(slug: string): Promise<ProblemPublic | null> {
  const snap = await adminDb.collection(COL).where("slug", "==", slug).limit(1).get();
  if (snap.empty) return null;
  return stripPrivate(snap.docs[0].id, snap.docs[0].data());
}

/** Accepts either a document id or a slug. */
export async function resolve(idOrSlug: string): Promise<ProblemPublic | null> {
  return (await getPublic(idOrSlug)) ?? (await getBySlug(idOrSlug));
}

export async function getPrivateTests(id: string): Promise<ProblemPrivateTests | null> {
  const snap = await adminDb.collection(COL).doc(id).collection("private").doc("tests").get();
  return snap.exists ? ProblemPrivateTestsSchema.parse(snap.data()) : null;
}

export async function getDrivers(id: string): Promise<ProblemPrivateDrivers | null> {
  const snap = await adminDb.collection(COL).doc(id).collection("private").doc("drivers").get();
  return snap.exists ? ProblemPrivateDriversSchema.parse(snap.data()) : null;
}

export interface ProblemDraft {
  problem: Omit<Problem, "createdAt" | "verifiedAt" | "stats" | "flagged"> & Partial<Pick<Problem, "stats" | "flagged">>;
  tests: ProblemPrivateTests;
  drivers: ProblemPrivateDrivers;
  /** Optional fixed id (e.g. the slug for seeded problems). */
  id?: string;
}

/** Writes the public doc + both private docs atomically. Status stays whatever the draft says (default "draft"). */
export async function create(draft: ProblemDraft): Promise<string> {
  const ref = draft.id ? adminDb.collection(COL).doc(draft.id) : adminDb.collection(COL).doc();
  const now = Timestamp.now();
  const doc = ProblemSchema.parse({ ...draft.problem, createdAt: now, verifiedAt: draft.problem.status === "verified" ? now : null });
  const tests = ProblemPrivateTestsSchema.parse(draft.tests);
  const drivers = ProblemPrivateDriversSchema.parse(draft.drivers);
  const batch = adminDb.batch();
  batch.set(ref, doc);
  batch.set(ref.collection("private").doc("tests"), tests);
  batch.set(ref.collection("private").doc("drivers"), drivers);
  await batch.commit();
  return ref.id;
}

export async function markVerified(id: string, languages: Language[]): Promise<void> {
  await adminDb.collection(COL).doc(id).update({
    status: "verified",
    verifiedAt: Timestamp.now(),
    languages: FieldValue.arrayUnion(...languages),
  });
}

/** Adds a verified driver (+ optional reference solution) for one more language. */
export async function addLanguage(id: string, language: Language, driver: string, referenceSolution?: string, starter?: string): Promise<void> {
  const ref = adminDb.collection(COL).doc(id);
  const batch = adminDb.batch();
  batch.set(ref.collection("private").doc("drivers"), { drivers: { [language]: driver } }, { merge: true });
  if (referenceSolution) batch.set(ref.collection("private").doc("tests"), { referenceSolution: { [language]: referenceSolution } }, { merge: true });
  const pub: Record<string, unknown> = { languages: FieldValue.arrayUnion(language) };
  if (starter) pub[`starter.${language}`] = starter;
  batch.update(ref, pub);
  await batch.commit();
}

export interface SearchOptions {
  tags?: string[];
  difficulty?: Difficulty;
  status?: ProblemStatus;
  excludeIds?: string[];
  limit?: number;
  cursor?: string; // document id of the last item from the previous page
}

export interface ProblemSummary {
  id: string; slug: string; number: number | null; title: string; difficulty: Difficulty; tags: string[];
  companies: string[]; languages: Language[]; acceptanceRate: number; attempts: number; rating: number; source: Problem["source"]; status: ProblemStatus;
}

export function toSummary(p: ProblemPublic): ProblemSummary {
  return {
    id: p.id, slug: p.slug, number: p.number, title: p.title, difficulty: p.difficulty, tags: p.tags, companies: p.companies,
    languages: p.languages, acceptanceRate: p.stats.acceptanceRate, attempts: p.stats.attempts, rating: p.rating, source: p.source, status: p.status,
  };
}

/** Cursor-paginated search over verified problems. Uses one `array-contains` tag (Firestore limit) and filters the rest in memory. */
export async function search(opts: SearchOptions = {}): Promise<{ items: ProblemSummary[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  let q: FirebaseFirestore.Query = adminDb.collection(COL).where("status", "==", opts.status ?? "verified");
  if (opts.difficulty) q = q.where("difficulty", "==", opts.difficulty);
  const tags = (opts.tags ?? []).map((t) => t.toLowerCase());
  if (tags.length) q = q.where("tags", "array-contains", tags[0]);
  q = q.orderBy("createdAt", "desc").orderBy(FieldPath.documentId());
  if (opts.cursor) {
    const cur = await adminDb.collection(COL).doc(opts.cursor).get();
    if (cur.exists) q = q.startAfter(cur);
  }
  const exclude = new Set(opts.excludeIds ?? []);
  const items: ProblemSummary[] = [];
  let nextCursor: string | null = null;
  // Over-fetch to absorb in-memory filtering.
  const snap = await q.limit(limit * 2 + exclude.size).get();
  for (const d of snap.docs) {
    if (items.length >= limit) { nextCursor = items[items.length - 1].id; break; }
    if (exclude.has(d.id)) continue;
    const p = stripPrivate(d.id, d.data());
    if (tags.length > 1 && !tags.every((t) => p.tags.includes(t))) continue;
    items.push(toSummary(p));
  }
  if (!nextCursor && snap.size >= limit * 2 + exclude.size && items.length) nextCursor = items[items.length - 1].id;
  return { items, nextCursor };
}

/** Firestore vector search (requires the `embedding` vector index — see firestore.indexes.json). */
export async function findNearest(embedding: number[], k = 5, opts: { status?: ProblemStatus; maxDistance?: number } = {}) {
  let base: FirebaseFirestore.Query = adminDb.collection(COL);
  if (opts.status) base = base.where("status", "==", opts.status);
  const snap = await base
    .findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(embedding),
      limit: k,
      distanceMeasure: "COSINE",
      distanceResultField: "_distance",
      ...(opts.maxDistance !== undefined ? { distanceThreshold: opts.maxDistance } : {}),
    })
    .get();
  return snap.docs.map((d) => {
    const { _distance, ...data } = d.data() as FirebaseFirestore.DocumentData & { _distance: number };
    return { distance: _distance as number, ...stripPrivate(d.id, data) };
  });
}

export async function incrementFlag(id: string, reason: string): Promise<{ count: number; retired: boolean }> {
  const ref = adminDb.collection(COL).doc(id);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { count: 0, retired: false };
    const count = ((snap.data()?.flagged?.count as number) ?? 0) + 1;
    const retired = count >= 2;
    tx.update(ref, {
      "flagged.count": count,
      "flagged.reasons": FieldValue.arrayUnion(reason),
      ...(retired ? { status: "retired" } : {}),
    });
    return { count, retired };
  });
}
