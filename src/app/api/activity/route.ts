import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as activity from "@/lib/data/activity";

/** Heatmap source. Added in Module 01 so the legacy profile page has a data source; Module 04 may extend it. */
export const GET = handler(
  { evt: "activity.year", query: z.object({ year: z.coerce.number().int().min(2020).max(2100).optional() }) },
  async ({ user, query }) => {
    const year = query.year ?? new Date().getUTCFullYear();
    const days = await activity.listYear(user.uid, year);
    const heatmap: Record<string, number> = {};
    let totalSubmissions = 0;
    for (const d of days) { heatmap[d.date] = d.submissions; totalSubmissions += d.submissions; }
    return { year, heatmap, totalSubmissions, activeDays: days.length, days: days.map((d) => ({ date: d.date, submissions: d.submissions, accepted: d.accepted, timeSpentSec: d.timeSpentSec, runs: d.runs })) };
  },
);
