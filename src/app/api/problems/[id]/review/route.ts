import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import { assertNotInActiveInterview } from "@/lib/practice/interview";
import * as submissions from "@/lib/data/submissions";
import { serialize } from "@/lib/data/schema";
import { consumeQuota } from "@/lib/auth/quotas";
import { reviewSubmission } from "@/lib/ai/features";

export const maxDuration = 60;
const BodySchema = z.object({ submissionId: z.string().min(1) });

/** Post-AC code review, at most one model call per accepted submission (cached on the submission). */
export const POST = handler({ evt: "problems.review", feature: "review", body: BodySchema }, async ({ user, body, params }) => {
  const p = await problems.resolve(params.id);
  if (!p || p.status === "draft") throw ApiError.notFound("Problem not found");
  await assertNotInActiveInterview(user.uid, p.id);
  const sub = await submissions.get(body.submissionId, user.uid);
  if (!sub || sub.problemId !== p.id) throw ApiError.notFound("Submission not found");
  const res = await reviewSubmission(p, sub, user.uid);
  if (!res.cached) await consumeQuota(user.uid, "review");
  return { review: serialize(res.review), cached: res.cached, ...(user.isAdmin ? { costUsd: res.costUsd } : {}) };
});
