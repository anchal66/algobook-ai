import { handler } from "@/lib/api/handler";
import { adminDb } from "@/lib/firebase-admin";
import * as problems from "@/lib/data/problems";
import * as activity from "@/lib/data/activity";
import { todayKey } from "@/lib/data/schema";

/** `GET /api/public/stats` (Module 05 U-10): live counters for the landing hero. Public, cached 60 s per instance. */
let cache: { at: number; data: { problemsVerified: number; solvesToday: number; usersRanked: number; languages: number } } | null = null;

export const GET = handler({ evt: "public.stats", auth: "none" }, async () => {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const today = todayKey();
  const [cat, meta, days] = await Promise.all([
    problems.catalog(),
    adminDb.collection("leaderboard").doc("meta").get(),
    activity.listRange(today, today, 5000),
  ]);
  const data = {
    problemsVerified: cat.total,
    solvesToday: days.reduce((a, d) => a + d.accepted, 0),
    usersRanked: Number(meta.data()?.totalRanked ?? 0),
    languages: 4,
  };
  cache = { at: Date.now(), data };
  return data;
});
