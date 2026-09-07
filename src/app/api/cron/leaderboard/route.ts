import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { runLeaderboardSnapshot } from "@/jobs/leaderboard-snapshot";

export const maxDuration = 300;

/** Vercel Cron entry (hourly): `Authorization: Bearer $CRON_SECRET`. Global top-100, template cohorts, weekly board. */
export const GET = handler({ evt: "cron.leaderboard", auth: "none" }, async ({ req }) => {
  const secret = env.CRON_SECRET;
  if (!secret) throw ApiError.forbidden("CRON_SECRET is not configured");
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) throw ApiError.unauthenticated("Bad cron secret");
  const url = new URL(req.url);
  const companies = url.searchParams.get("companies")?.split(",").filter(Boolean);
  return runLeaderboardSnapshot({ companies });
});
