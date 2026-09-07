import { handler } from "@/lib/api/handler";
import * as activity from "@/lib/data/activity";
import { serialize, todayKey } from "@/lib/data/schema";
import { DAILY_XP_BONUS, ensureDaily, ensureDailyProject, linkDailyToProject } from "@/jobs/daily-challenge";

/** Today's daily challenge with the caller's status; solving goes through the user's system "Daily" project. */
export const GET = handler({ evt: "daily.get" }, async ({ user }) => {
  const today = todayKey();
  const ensured = await ensureDaily(today);
  if (!ensured) return { date: today, challenge: null, solved: false, projectId: null, xpBonus: DAILY_XP_BONUS };
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
  };
});
