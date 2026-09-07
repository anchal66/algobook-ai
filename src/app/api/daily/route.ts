import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as activity from "@/lib/data/activity";
import * as dailyStore from "@/lib/data/daily";
import { serialize, todayKey } from "@/lib/data/schema";
import { DAILY_XP_BONUS, ensureDaily, ensureDailyProject, linkDailyToProject } from "@/jobs/daily-challenge";

/** Today's daily challenge with the caller's status; solving goes through the user's system "Daily" project. */
export const GET = handler({ evt: "daily.get", query: z.object({ days: z.coerce.number().int().min(0).max(60).optional() }) }, async ({ user, query }) => {
  const today = todayKey();
  // Module 05 (U-18): `?days=30` adds the past challenges with the caller's solved flags.
  let history: { date: string; solved: boolean; title: string; slug: string; difficulty: string; problemId: string }[] | undefined;
  if (query.days) {
    const from = new Date(Date.parse(today + "T00:00:00Z") - query.days * 86_400_000).toISOString().slice(0, 10);
    const [challenges, acts] = await Promise.all([dailyStore.listRange(from, today), activity.listYear(user.uid, new Date().getUTCFullYear())]);
    const solvedDays = new Set(acts.filter((a) => a.dailySolved).map((a) => a.date));
    history = challenges.map((c) => ({ date: c.date, solved: solvedDays.has(c.date), title: c.title, slug: c.slug, difficulty: c.difficulty, problemId: c.problemId })).sort((a, b) => b.date.localeCompare(a.date));
  }
  const ensured = await ensureDaily(today);
  if (!ensured) return { date: today, challenge: null, solved: false, projectId: null, xpBonus: DAILY_XP_BONUS, history };
  const [project, day] = await Promise.all([ensureDailyProject(user.uid, user.doc), activity.getDay(user.uid, today)]);
  const item = await linkDailyToProject(project.id, ensured.challenge);
  const { createdAt: _c, ...challenge } = ensured.challenge;
  return {
    date: today,
    challenge: serialize(challenge),
    solved: day?.dailySolved === true,
    projectId: project.id,
    itemStatus: item.status,
    xpBonus: DAILY_XP_BONUS,
    dailySolvedTotal: user.doc.stats.dailySolved,
    history,
  };
});
