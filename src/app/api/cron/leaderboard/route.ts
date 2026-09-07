import { handler } from "@/lib/api/handler";
import { assertCron } from "@/lib/api/cron";
import { runLeaderboardSnapshot } from "@/jobs/leaderboard-snapshot";

export const maxDuration = 300;

/** Vercel Cron entry (hourly): `Authorization: Bearer $CRON_SECRET`. Global top-100, template cohorts, weekly board. */
export const GET = handler({ evt: "cron.leaderboard", auth: "none" }, async ({ req }) => {
  assertCron(req);
  const url = new URL(req.url);
  const companies = url.searchParams.get("companies")?.split(",").filter(Boolean);
  return runLeaderboardSnapshot({ companies });
});
