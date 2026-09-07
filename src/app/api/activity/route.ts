import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as activity from "@/lib/data/activity";
import { todayKey } from "@/lib/data/schema";
import { longestRun } from "@/lib/practice/calendar";
import { streakStatus } from "@/lib/practice/stats";

/** Heatmap + streak summary from `activity` docs (≤ 366 reads by key range). Module 04 §3.9. */
export const GET = handler(
  { evt: "activity.year", query: z.object({ year: z.coerce.number().int().min(2020).max(2100).optional() }) },
  async ({ user, query }) => {
    const today = todayKey();
    const year = query.year ?? new Date().getUTCFullYear();
    const days = await activity.listYear(user.uid, year);
    const heatmap: Record<string, number> = {};
    let totalSubmissions = 0, totalAccepted = 0;
    for (const d of days) { heatmap[d.date] = d.submissions; totalSubmissions += d.submissions; totalAccepted += d.accepted; }
    const s = user.doc.stats;
    return {
      year, heatmap, totalSubmissions, totalAccepted, activeDays: days.length,
      maxStreak: Math.max(longestRun(days.map((d) => d.date)), year === new Date().getUTCFullYear() ? s.longestStreak : 0),
      currentStreak: s.currentStreak, longestStreak: s.longestStreak, streakFreezes: s.streakFreezes,
      streak: streakStatus(s, today),
      days: days.map((d) => ({ date: d.date, submissions: d.submissions, accepted: d.accepted, timeSpentSec: d.timeSpentSec, runs: d.runs, xpEarned: d.xpEarned, projectIds: d.projectIds, dailySolved: d.dailySolved })),
    };
  },
);
