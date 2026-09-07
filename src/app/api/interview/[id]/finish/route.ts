import { handler } from "@/lib/api/handler";
import { serialize } from "@/lib/data/schema";
import { finishInterview } from "@/lib/practice/interview";

export const maxDuration = 60;

/** Ends the interview and generates the interviewer debrief (one model call, cached on the doc). */
export const POST = handler({ evt: "interview.finish" }, async ({ user, params }) => {
  const out = await finishInterview(params.id, user.uid);
  return { interview: serialize(out.interview), cached: out.cached, ...(user.isAdmin ? { costUsd: out.costUsd } : {}) };
});
