import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { serialize, todayKey } from "@/lib/data/schema";
import { TEMPLATE_COMPANIES } from "@/lib/practice/achievements";
import { globalPage, isoWeekOf, myStanding, readCohort, readWeek } from "@/lib/practice/leaderboard";

const QuerySchema = z.object({
  scope: z.enum(["global", "template", "week"]).default("global"),
  company: z.string().regex(/^[a-z]+$/).optional(),
  week: z.string().regex(/^\d{4}-W\d{2}$/).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Global: one ordered page over `users` (≤ 51 reads, logged) + my rank by a single `count()`.
 * Template / week: hourly snapshots (`leaderboard/template_{company}`, `leaderboard/week_{yyyy-Www}`).
 */
export const GET = handler({ evt: "leaderboard.get", query: QuerySchema }, async ({ user, query }) => {
  if (query.scope === "global") {
    const [page, me] = await Promise.all([globalPage({ cursor: query.cursor, limit: query.limit }), myStanding(user.uid, user.doc.stats.score)]);
    console.info(JSON.stringify({ evt: "leaderboard.reads", scope: "global", reads: page.reads, page: page.entries.length }));
    return { scope: "global", entries: page.entries, nextCursor: page.nextCursor, me: { uid: user.uid, score: user.doc.stats.score, ...me }, reads: page.reads };
  }
  if (query.scope === "template") {
    const company = query.company ?? "";
    if (!TEMPLATE_COMPANIES[company]) throw ApiError.validation(`Unknown template company "${company}"`);
    const snap = await readCohort(company);
    const mine = snap?.entries.find((e) => e.uid === user.uid) ?? null;
    return { scope: "template", company, label: TEMPLATE_COMPANIES[company], updatedAt: snap ? snap.updatedAt.toDate().toISOString() : null, entries: snap?.entries ?? [], me: mine };
  }
  const week = query.week ?? isoWeekOf(todayKey()).week;
  const snap = await readWeek(week);
  const mine = snap?.entries.find((e) => e.uid === user.uid) ?? null;
  return { scope: "week", week, range: snap ? { from: snap.from, to: snap.to } : isoWeekOf(todayKey()), updatedAt: snap ? snap.updatedAt.toDate().toISOString() : null, entries: serialize(snap?.entries ?? []), me: mine };
});
