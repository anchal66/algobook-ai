import "server-only";
/**
 * Leaderboard (Module 04 §3.10). Global scope is O(page): `users` ordered by `stats.score` (single-field
 * index, no composite needed), my rank via one `count()` aggregation, percentile from a cached total.
 * Template cohorts and weekly boards are snapshots written by `jobs/leaderboard-snapshot.ts`.
 */
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { CohortSnapshotSchema, LeaderboardMetaSchema, LeaderboardSnapshotSchema, WeeklySnapshotSchema, type CohortSnapshot, type LeaderboardSnapshot, type WeeklySnapshot } from "@/lib/data/schema";
import { assignRanks, entryFromUser, percentileFor, type RankedUser } from "@/lib/practice/rank";
import { isoWeekOf } from "@/lib/practice/calendar";

export { assignRanks, entryFromUser, isoWeekOf };
export type { RankedUser };

export const PAGE_SIZE = 50;
export const META_TTL_MS = 10 * 60_000;

/** Inequality + order on the same field → served by the automatic single-field index (no composite needed). */
function rankedQuery() {
  return adminDb.collection("users").where("stats.score", ">", 0).orderBy("stats.score", "desc");
}

/** Users with a strictly higher score + 1 (ties share the rank). One aggregation query. */
export async function rankForScore(score: number): Promise<number> {
  const agg = await adminDb.collection("users").where("stats.score", ">", score).count().get();
  return agg.data().count + 1;
}

/** Cached ranked-user total (`leaderboard/meta`), refreshed when older than 10 minutes. */
export async function totalRanked(force = false): Promise<number> {
  const ref = adminDb.collection("leaderboard").doc("meta");
  const snap = await ref.get();
  if (!force && snap.exists) {
    const meta = LeaderboardMetaSchema.parse(snap.data());
    if (Date.now() - meta.updatedAt.toMillis() < META_TTL_MS) return meta.totalRanked;
  }
  const agg = await adminDb.collection("users").where("stats.score", ">", 0).count().get();
  const total = agg.data().count;
  await ref.set({ totalRanked: total, updatedAt: Timestamp.now() });
  return total;
}

export interface GlobalPage { entries: RankedUser[]; nextCursor: string | null; reads: number }

/** One page of the global board. Reads ≤ PAGE_SIZE + 1 user docs (+ the cursor doc). */
export async function globalPage(opts: { cursor?: string; limit?: number } = {}): Promise<GlobalPage> {
  const limit = Math.min(Math.max(opts.limit ?? PAGE_SIZE, 1), PAGE_SIZE);
  let q = rankedQuery();
  let reads = 0;
  if (opts.cursor) {
    const cur = await adminDb.collection("users").doc(opts.cursor).get();
    reads += 1;
    if (cur.exists) q = q.startAfter(cur);
  }
  const snap = await q.limit(limit + 1).select("username", "displayName", "photoURL", "stats").get();
  reads += snap.size;
  const docs = snap.docs.slice(0, limit);
  if (!docs.length) return { entries: [], nextCursor: null, reads };
  // First page starts at rank 1 — no aggregation round-trip; later pages need the base rank of their first row.
  const baseRank = opts.cursor ? await rankForScore((docs[0].data().stats?.score as number) ?? 0) : 1;
  const entries = assignRanks(docs.map((d) => entryFromUser(d.id, d.data(), 0)), baseRank);
  return { entries, nextCursor: snap.docs.length > limit ? docs[docs.length - 1].id : null, reads };
}

/** Top-N for the snapshot job (single ordered query). */
export async function topRanked(n = 100): Promise<RankedUser[]> {
  const snap = await rankedQuery().limit(n).select("username", "displayName", "photoURL", "stats").get();
  return assignRanks(snap.docs.map((d) => entryFromUser(d.id, d.data(), 0)), 1);
}

export async function myStanding(uid: string, score: number): Promise<{ rank: number | null; percentile: number | null; total: number }> {
  // meta read and the rank aggregation are independent → one round-trip instead of two
  const [total, rank] = await Promise.all([totalRanked(), score > 0 ? rankForScore(score) : Promise.resolve(null)]);
  if (rank === null) return { rank: null, percentile: null, total };
  return { rank, percentile: percentileFor(rank, total), total };
}

export async function readGlobalSnapshot(): Promise<LeaderboardSnapshot | null> {
  const snap = await adminDb.collection("leaderboard").doc("global").get();
  return snap.exists ? LeaderboardSnapshotSchema.parse(snap.data()) : null;
}

export async function readCohort(company: string): Promise<CohortSnapshot | null> {
  const snap = await adminDb.collection("leaderboard").doc(`template_${company}`).get();
  return snap.exists ? CohortSnapshotSchema.parse(snap.data()) : null;
}

export async function readWeek(week: string): Promise<WeeklySnapshot | null> {
  const snap = await adminDb.collection("leaderboard").doc(`week_${week}`).get();
  return snap.exists ? WeeklySnapshotSchema.parse(snap.data()) : null;
}

