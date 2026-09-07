import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { serialize } from "@/lib/data/schema";
import { consumeQuota } from "@/lib/auth/quotas";
import { INTERVIEW_DURATIONS, startInterview } from "@/lib/practice/interview";

const BodySchema = z.object({
  durationMin: z.number().int().refine((n) => (INTERVIEW_DURATIONS as readonly number[]).includes(n), "durationMin must be 30, 45 or 60").default(45),
  difficulty: z.enum(["mixed", "medium", "hard"]).default("mixed"),
});

/** Opens a timed mock interview (D-11): 2 problems by rating, `interviews/{id}` with a deadline. Quota key `interview`. */
export const POST = handler({ evt: "interview.start", feature: "interview", body: BodySchema }, async ({ user, body }) => {
  const out = await startInterview(user.uid, user.doc, body);
  await consumeQuota(user.uid, "interview");
  return { interview: serialize(out.interview), projectId: out.projectId, mode: { hints: false, editorial: false, tutor: false, countdown: true } };
});
