import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { pregenTick } from "@/jobs/pregen";

export const maxDuration = 300;

/** Vercel Cron entry (hourly): `Authorization: Bearer $CRON_SECRET`. Collects finished batches, then submits a new one. */
export const GET = handler({ evt: "cron.pregen", auth: "none" }, async ({ req }) => {
  const secret = env.CRON_SECRET;
  if (!secret) throw ApiError.forbidden("CRON_SECRET is not configured");
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) throw ApiError.unauthenticated("Bad cron secret");
  const url = new URL(req.url);
  const companies = url.searchParams.get("companies")?.split(",").filter(Boolean);
  return pregenTick({ companies, submit: url.searchParams.get("submit") !== "0" });
});
