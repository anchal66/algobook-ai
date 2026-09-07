/**
 * Module 04 P-21: leaderboard load test. Seeds N simulated users (each run through the real stats
 * engine for M submissions — mastery, SRS, rating, xp, score), then measures GET /api/leaderboard
 * latency and asserts p95 < 300 ms. Seeded docs carry `loadTest: true` and usernames `lt_<n>`.
 *
 *   npm run load:leaderboard -- --uid <uid> [--users 1000] [--subs 20] [--requests 40] [--base http://localhost:3000]
 *   npm run load:leaderboard -- --cleanup          # delete every seeded user
 */
import "./_bootstrap";
import { args } from "./_bootstrap";
import { mintIdToken } from "./dev-token";
import { getAdminDb } from "../src/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { UserSchema, type Difficulty } from "../src/lib/data/schema";
import { CORE_TOPICS } from "../src/lib/practice/topics";
import { applySubmissionToStats } from "../src/lib/practice/stats";
import { rng } from "../src/lib/practice/recommend";

const DIFFS: Difficulty[] = ["Easy", "Medium", "Hard"];

function simulateUser(i: number, subs: number) {
  const rand = rng(1000 + i);
  const now = new Date();
  let doc: Record<string, unknown> = { ...UserSchema.parse({ username: `lt_${i}`, displayName: `Load Tester ${i}`, createdAt: Timestamp.fromDate(now), updatedAt: Timestamp.fromDate(now) }), loadTest: true };
  const unlocked: string[] = [];
  const skill = 0.3 + rand() * 0.6; // per-user pass probability
  for (let s = 0; s < subs; s++) {
    const day = new Date(now.getTime() - (subs - s) * 86_400_000 * (rand() < 0.8 ? 1 : 2));
    const difficulty = DIFFS[Math.floor(rand() * 3)];
    const accepted = rand() < skill;
    const attemptNumber = accepted && rand() < 0.7 ? 1 : 2;
    const r = applySubmissionToStats(doc, unlocked, {
      submissionId: `lt_${i}_${s}`, problemId: `p_${i}_${s}`, accepted, firstAccept: accepted, alreadyAccepted: false, attemptNumber,
      difficulty, tags: [CORE_TOPICS[Math.floor(rand() * CORE_TOPICS.length)], CORE_TOPICS[Math.floor(rand() * CORE_TOPICS.length)]],
      language: rand() < 0.5 ? "java" : "python", timeSpentSec: Math.round(200 + rand() * 2000), hintsUsed: rand() < 0.3 ? 1 : 0, runCount: 1 + Math.floor(rand() * 6),
      editorialViewed: false, problemRating: 1100 + Math.floor(rand() * 900), isDailyChallenge: false, now: day,
    });
    doc = { ...doc, ...r.updates };
    unlocked.push(...r.newlyUnlocked);
  }
  return doc;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  const a = args();
  const db = getAdminDb();
  if (a.cleanup === true) {
    let deleted = 0;
    for (;;) {
      const snap = await db.collection("users").where("loadTest", "==", true).limit(100).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;
    }
    console.log(`deleted ${deleted} load-test user(s)`);
    return;
  }
  const users = Number(a.users ?? 1000);
  const subs = Number(a.subs ?? 20);
  const requests = Number(a.requests ?? 40);
  const base = String(a.base ?? "http://localhost:3000");
  const uid = String(a.uid ?? "");
  if (!uid) throw new Error("usage: --uid <uid> (a real user to call the API as)");

  const t0 = Date.now();
  let written = 0;
  const BATCH = 100;
  for (let start = a.skipSeed === true ? users : 0; start < users; start += BATCH) {
    const batch = db.batch();
    for (let i = start; i < Math.min(users, start + BATCH); i++) batch.set(db.collection("users").doc(`loadtest_${i}`), simulateUser(i, subs));
    try {
      await batch.commit();
    } catch (e) {
      console.error(`\nbatch ${start} failed: ${(e as Error).message}`);
      throw e;
    }
    written += Math.min(users, start + BATCH) - start;
    process.stdout.write(`\rseeded ${written}/${users}`);
  }
  console.log(`\nseeded ${users} users × ${subs} submissions in ${Date.now() - t0} ms`);

  const { idToken } = await mintIdToken({ uid });
  const latencies: number[] = [];
  let reads = 0, cursor: string | null = null, rank: number | null = null;
  for (let i = 0; i < requests; i++) {
    const useCursor: string | null = i % 4 === 1 ? cursor : null;
    const url: string = `${base}/api/leaderboard?scope=global${useCursor ? `&cursor=${useCursor}` : ""}`;
    const t = Date.now();
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    const body: { reads?: number; nextCursor?: string | null; me?: { rank?: number } } = await res.json();
    latencies.push(Date.now() - t);
    if (res.status !== 200) throw new Error(`leaderboard ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
    reads = Math.max(reads, body.reads ?? 0);
    cursor = body.nextCursor ?? cursor;
    rank = body.me?.rank ?? rank;
  }
  const p50 = percentile(latencies, 50), p95 = percentile(latencies, 95), max = Math.max(...latencies);
  console.log(`GET /api/leaderboard × ${requests}: p50 ${p50} ms, p95 ${p95} ms, max ${max} ms, reads/page ≤ ${reads}, my rank ${rank}`);
  console.log(p95 < 300 ? "PASS  p95 < 300 ms" : "FAIL  p95 ≥ 300 ms");
  console.log("run with --cleanup to remove the seeded users");
  process.exit(p95 < 300 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
