import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { serialize, todayKey } from "@/lib/data/schema";
import { runLeaderboardSnapshot } from "@/jobs/leaderboard-snapshot";
import { ensureDaily } from "@/jobs/daily-challenge";

export const maxDuration = 300;

const BodySchema = z.object({
  action: z.enum(["snapshot", "daily"]).default("snapshot"),
  companies: z.array(z.string().regex(/^[a-z]+$/)).max(6).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Admin trigger for the leaderboard snapshot and the daily-challenge picker (Module 04 §3.10 / §3.11). */
export const POST = handler({ evt: "admin.leaderboard-snapshot", admin: true, body: BodySchema }, async ({ body }) => {
  if (body.action === "daily") {
    const out = await ensureDaily(body.date ?? todayKey());
    return out ? { created: out.created, challenge: serialize(out.challenge) } : { created: false, challenge: null };
  }
  return runLeaderboardSnapshot({ companies: body.companies, dayKey: body.date });
});
