import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { assertCron } from "@/lib/api/cron";
import { serialize, todayKey } from "@/lib/data/schema";
import { ensureDaily } from "@/jobs/daily-challenge";

export const maxDuration = 60;

/** Vercel Cron entry (00:00 UTC): `Authorization: Bearer $CRON_SECRET`. Picks today's daily challenge (idempotent). */
export const GET = handler({ evt: "cron.daily", auth: "none" }, async ({ req }) => {
  assertCron(req);
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw ApiError.validation("date must be YYYY-MM-DD");
  const out = await ensureDaily(date);
  return out ? { date, created: out.created, challenge: serialize(out.challenge) } : { date, created: false, challenge: null };
});
