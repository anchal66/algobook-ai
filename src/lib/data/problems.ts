import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { FALLBACK_SCAN_LIMIT, isMissingIndexError, onMissingIndex } from "@/lib/data/_firestore";
import {
  ProblemSchema, ProblemPrivateTestsSchema, ProblemPrivateDriversSchema, ProblemHintsSchema, ProblemEditorialSchema, LanguageJobSchema,
  type Difficulty, type Language, type LanguageJob, type Problem, type ProblemEditorial, type ProblemHints, type ProblemPrivateDrivers, type ProblemPrivateTests, type ProblemStatus, type WithId,
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
  problem: Omit<Problem, "createdAt" | "verifiedAt" | "stats" | "flagged" | "languageJobs" | "lastServedAt"> & Partial<Pick<Problem, "stats" | "flagged" | "languageJobs" | "lastServedAt">>;
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
  const tags = (opts.tags ?? []).map((t) => t.toLowerCase());
  const exclude = new Set(opts.excludeIds ?? []);

  const filtered = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => {
    const out: ProblemSummary[] = [];
    for (const d of docs) {
      if (exclude.has(d.id)) continue;
      const p = stripPrivate(d.id, d.data());
      if (tags.length > 1 && !tags.every((t) => p.tags.includes(t))) continue;
      out.push(toSummary(p));
    }
    return out;
  };

  const base = () => {
    let q: FirebaseFirestore.Query = adminDb.collection(COL).where("status", "==", opts.status ?? "verified");
    if (opts.difficulty) q = q.where("difficulty", "==", opts.difficulty);
    if (tags.length) q = q.where("tags", "array-contains", tags[0]);
    return q;
  };

  try {
    let q = base().orderBy("createdAt", "desc");
    if (opts.cursor) {
      const cur = await adminDb.collection(COL).doc(opts.cursor).get();
      if (cur.exists) q = q.startAfter(cur);
    }
    // Over-fetch to absorb in-memory filtering.
    const snap = await q.limit(limit * 2 + exclude.size + 1).get();
    const items = filtered(snap.docs).slice(0, limit);
    const more = snap.size > items.length + exclude.size;
    return { items, nextCursor: more && items.length ? items[items.length - 1].id : null };
  } catch (e) {
    if (!isMissingIndexError(e)) throw e;
    // No composite index yet: equality-only scan, ordered in memory.
    onMissingIndex("problems(status, difficulty, tags, createdAt desc)");
    const snap = await base().limit(FALLBACK_SCAN_LIMIT).get();
    const sorted = [...snap.docs].sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0));
    const all = filtered(sorted);
    const start = opts.cursor ? all.findIndex((p) => p.id === opts.cursor) + 1 : 0;
    const items = all.slice(start, start + limit);
    const more = all.length > start + limit;
    return { items, nextCursor: more && items.length ? items[items.length - 1].id : null };
  }
}

// ── Module 05: Explore catalog ───────────────────────────────────────────────

export interface CatalogRow {
  id: string; slug: string; number: number | null; title: string; difficulty: Difficulty; tags: string[]; companies: string[];
  acceptanceRate: number; attempts: number; rating: number; languages: Language[]; source: Problem["source"]; createdAt: string;
}
const CATALOG_TTL_MS = 60_000;
let catalogCache: { at: number; items: CatalogRow[] } | null = null;
let catalogInflight: Promise<CatalogRow[]> | null = null;

/** Every verified problem as a compact row (no embedding, no statement). Cached per instance for 60 s. */
export async function catalog(): Promise<{ items: CatalogRow[]; total: number; cachedAt: string }> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return { items: catalogCache.items, total: catalogCache.items.length, cachedAt: new Date(catalogCache.at).toISOString() };
  if (!catalogInflight) {
    catalogInflight = adminDb.collection(COL).where("status", "==", "verified")
      .select("slug", "number", "title", "difficulty", "tags", "companies", "stats.acceptanceRate", "stats.attempts", "rating", "languages", "source", "createdAt")
      .get()
      .then((snap) => {
        const items = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id, slug: String(x.slug ?? d.id), number: typeof x.number === "number" ? x.number : null, title: String(x.title ?? ""), difficulty: (x.difficulty ?? "Medium") as Difficulty,
            tags: (x.tags ?? []) as string[], companies: (x.companies ?? []) as string[], acceptanceRate: Number(x.stats?.acceptanceRate ?? 0), attempts: Number(x.stats?.attempts ?? 0),
            rating: Number(x.rating ?? 1200), languages: (x.languages ?? []) as Language[], source: (x.source ?? "generated") as Problem["source"],
            createdAt: x.createdAt?.toDate?.().toISOString?.() ?? "",
          } satisfies CatalogRow;
        }).sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9) || a.createdAt.localeCompare(b.createdAt));
        catalogCache = { at: Date.now(), items };
        return items;
      })
      .finally(() => { catalogInflight = null; });
  }
  const items = await catalogInflight;
  return { items, total: items.length, cachedAt: new Date(catalogCache?.at ?? Date.now()).toISOString() };
}

/** Admin moderation: status change + cache bust. */
export async function setStatus(id: string, status: ProblemStatus): Promise<void> {
  await adminDb.collection(COL).doc(id).update({ status });
  catalogCache = null;
}

/** Problems with at least one flag, most-flagged first (single-field range query on `flagged.count`). */
export async function listFlagged(limit = 100): Promise<(ProblemPublic & { flagCount: number; flagReasons: string[] })[]> {
  const snap = await adminDb.collection(COL).where("flagged.count", ">", 0).orderBy("flagged.count", "desc").limit(limit).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return { ...stripPrivate(d.id, data), flagCount: Number(data.flagged?.count ?? 0), flagReasons: (data.flagged?.reasons ?? []) as string[] };
  });
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

// ── Module 02 additions ──────────────────────────────────────────────────────

export async function getHints(id: string): Promise<ProblemHints | null> {
  const snap = await adminDb.collection(COL).doc(id).collection("content").doc("hints").get();
  return snap.exists ? ProblemHintsSchema.parse(snap.data()) : null;
}

export async function setHints(id: string, hints: ProblemHints["hints"]): Promise<void> {
  const batch = adminDb.batch();
  batch.set(adminDb.collection(COL).doc(id).collection("content").doc("hints"), ProblemHintsSchema.parse({ hints }));
  batch.update(adminDb.collection(COL).doc(id), { hintsPreview: hints.length });
  await batch.commit();
}

export async function getEditorial(id: string): Promise<ProblemEditorial | null> {
  const snap = await adminDb.collection(COL).doc(id).collection("content").doc("editorial").get();
  return snap.exists ? ProblemEditorialSchema.parse(snap.data()) : null;
}

export async function setEditorial(id: string, editorial: Omit<ProblemEditorial, "createdAt">): Promise<ProblemEditorial> {
  const doc = ProblemEditorialSchema.parse({ ...editorial, createdAt: Timestamp.now() });
  await adminDb.collection(COL).doc(id).collection("content").doc("editorial").set(doc);
  return doc;
}

/** `stats.referenceRuntimeMs[lang]` — max reference runtime over all tests (TLE sanity). */
export async function setReferenceRuntime(id: string, language: Language, runtimeMs: number): Promise<void> {
  await adminDb.collection(COL).doc(id).update({ [`stats.referenceRuntimeMs.${language}`]: runtimeMs });
}

/** Returns the raw language-job map (in-flight driver generation, Module 02 §3.3 step 7). */
export async function getLanguageJobs(id: string): Promise<Partial<Record<Language, LanguageJob>>> {
  const snap = await adminDb.collection(COL).doc(id).get();
  const raw = (snap.data()?.languageJobs ?? {}) as Record<string, unknown>;
  const out: Partial<Record<Language, LanguageJob>> = {};
  for (const [k, v] of Object.entries(raw)) {
    const parsed = LanguageJobSchema.safeParse(v);
    if (parsed.success) out[k as Language] = parsed.data;
  }
  return out;
}

/**
 * Claims the driver-generation job for `language` in a transaction. Returns "claimed" when this
 * caller must do the work, "ready" when the language already exists, or "running" when another
 * request holds a fresh (< staleMs) claim.
 */
export async function claimLanguageJob(id: string, language: Language, staleMs = 5 * 60_000): Promise<"claimed" | "ready" | "running"> {
  const ref = adminDb.collection(COL).doc(id);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Problem not found");
    const data = snap.data()!;
    if ((data.languages as string[] | undefined)?.includes(language)) return "ready";
    const job = LanguageJobSchema.safeParse((data.languageJobs ?? {})[language]);
    if (job.success && job.data.status === "running" && job.data.startedAt && Date.now() - job.data.startedAt.toMillis() < staleMs) return "running";
    const now = Timestamp.now();
    tx.update(ref, { [`languageJobs.${language}`]: { status: "running", startedAt: now, updatedAt: now, error: null } });
    return "claimed";
  });
}

export async function finishLanguageJob(id: string, language: Language, status: "done" | "failed", error?: string): Promise<void> {
  await adminDb.collection(COL).doc(id).update({
    [`languageJobs.${language}.status`]: status,
    [`languageJobs.${language}.updatedAt`]: Timestamp.now(),
    [`languageJobs.${language}.error`]: error ?? null,
  });
}

/** Picks a slug that is not taken yet (`two-sum`, `two-sum-2`, …). */
export async function uniqueSlug(base: string): Promise<string> {
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "problem";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? clean : `${clean}-${i + 1}`;
    const snap = await adminDb.collection(COL).where("slug", "==", candidate).limit(1).get();
    if (snap.empty) return candidate;
  }
  return `${clean}-${Date.now().toString(36)}`;
}

/** Verified problems produced from a company template entry (Module 02 A-17 → Module 04 recommendFromTemplate). */
export async function findByTemplateTitle(title: string, opts: { excludeIds?: string[]; limit?: number } = {}): Promise<ProblemPublic[]> {
  const exclude = new Set(opts.excludeIds ?? []);
  const snap = await adminDb.collection(COL).where("status", "==", "verified").where("templateRef.title", "==", title).limit((opts.limit ?? 5) + exclude.size).get();
  return snap.docs.filter((d) => !exclude.has(d.id)).slice(0, opts.limit ?? 5).map((d) => stripPrivate(d.id, d.data()));
}

/** Verified problems generated from a company template: title → problem ids (Module 04 template preference). Equality-only query. */
export async function verifiedTemplateTitles(company: string, limit = 500): Promise<Map<string, string[]>> {
  const snap = await adminDb.collection(COL).where("status", "==", "verified").where("templateRef.company", "==", company).select("templateRef").limit(limit).get();
  const out = new Map<string, string[]>();
  for (const d of snap.docs) {
    const title = (d.data().templateRef as { title?: string } | undefined)?.title;
    if (!title) continue;
    out.set(title, [...(out.get(title) ?? []), d.id]);
  }
  return out;
}

/** Number of verified, non-retired problems in a topic×difficulty cell (pre-generation deficits). */
export async function countVerified(topic: string, difficulty: Difficulty): Promise<number> {
  const agg = await adminDb.collection(COL).where("status", "==", "verified").where("difficulty", "==", difficulty).where("tags", "array-contains", topic).count().get();
  return agg.data().count;
}

/** Recently served pointer used for "least recently served" tie-breaks in reuse. */
export async function touchServed(id: string): Promise<void> {
  await adminDb.collection(COL).doc(id).update({ lastServedAt: Timestamp.now() }).catch(() => undefined);
}
