import { handler } from "@/lib/api/handler";
import { assertCron } from "@/lib/api/cron";
import { pregenTick } from "@/jobs/pregen";

export const maxDuration = 300;

/** Vercel Cron entry (hourly): `Authorization: Bearer $CRON_SECRET`. Collects finished batches, then submits a new one. */
export const GET = handler({ evt: "cron.pregen", auth: "none" }, async ({ req }) => {
  assertCron(req);
  const url = new URL(req.url);
  const companies = url.searchParams.get("companies")?.split(",").filter(Boolean);
  return pregenTick({ companies, submit: url.searchParams.get("submit") !== "0" });
});
