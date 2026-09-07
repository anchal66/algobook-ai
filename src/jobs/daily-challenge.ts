import "server-only";
/**
 * Daily challenge (Module 04 §3.11). `ensureDaily(date)` picks a verified problem not used in the last
 * 90 days, difficulty rotating Easy/Medium/Medium/Hard by weekday, deterministically per date.
 * Runs from `/api/cron/daily` at 00:00 UTC and lazily from `GET /api/daily` when the cron has not fired.
 */
import * as daily from "@/lib/data/daily";
import * as problems from "@/lib/data/problems";
import * as projects from "@/lib/data/projects";
import { adminDb } from "@/lib/firebase-admin";
import { todayKey, type DailyChallenge, type Difficulty, type User, type WithId } from "@/lib/data/schema";
import { addDays } from "@/lib/practice/srs";
import { rng } from "@/lib/practice/recommend";
import { difficultyForDate } from "@/lib/practice/calendar";

export const REUSE_WINDOW_DAYS = 90;
export const DAILY_XP_BONUS = 20;
export { difficultyForDate };

function seedFor(date: string): number {
  let h = 2166136261;
  for (const ch of date) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export async function ensureDaily(date = todayKey()): Promise<{ challenge: WithId<DailyChallenge>; created: boolean } | null> {
  const existing = await daily.get(date);
  if (existing) return { challenge: existing, created: false };
  const used = await daily.usedProblemIds(addDays(date, -REUSE_WINDOW_DAYS), date);
  const preferred = difficultyForDate(date);
  const order: Difficulty[] = [preferred, ...(["Medium", "Easy", "Hard"] as Difficulty[]).filter((d) => d !== preferred)];
  const rand = rng(seedFor(date));
  for (const difficulty of order) {
    const res = await problems.search({ difficulty, status: "verified", excludeIds: used, limit: 50 });
    // prefer problems that already have several languages verified
    const pool = res.items.filter((p) => p.languages.length >= 2).length >= 5 ? res.items.filter((p) => p.languages.length >= 2) : res.items;
    if (!pool.length) continue;
    const pick = pool[Math.floor(rand() * pool.length)];
    const created = await daily.createIfMissing(date, { problemId: pick.id, title: pick.title, slug: pick.slug, difficulty: pick.difficulty, tags: pick.tags });
    console.info(JSON.stringify({ evt: "daily.ensure", date, problemId: pick.id, difficulty: pick.difficulty, created: created.created }));
    return created;
  }
  console.warn(JSON.stringify({ evt: "daily.ensure_failed", date, message: "no verified problem available" }));
  return null;
}

/** The user's system "Daily" project, created on first use and remembered on `users.dailyProjectId`. */
export async function ensureDailyProject(uid: string, user: Pick<User, "dailyProjectId">) {
  const project = await projects.ensureSystemProject(uid, "daily", "Daily Challenge", "One fresh problem every day. Solve it for +20 XP and a streak boost.", user.dailyProjectId);
  if (user.dailyProjectId !== project.id) await adminDb.collection("users").doc(uid).update({ dailyProjectId: project.id });
  return project;
}

/** Links today's challenge into the user's Daily project (idempotent). */
export async function linkDailyToProject(projectId: string, challenge: WithId<DailyChallenge>) {
  const item = await projects.getItem(projectId, challenge.problemId);
  if (item) return item;
  return projects.addItem(projectId, {
    problemId: challenge.problemId, title: challenge.title, difficulty: challenge.difficulty, tags: challenge.tags,
    reason: { short: `Daily challenge ${challenge.date}`, detail: "Today's community challenge. Solve it for +20 XP.", facts: [] }, source: "curated",
  });
}
