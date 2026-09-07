import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import { assertNotInActiveInterview } from "@/lib/practice/interview";
import { LanguageSchema } from "@/lib/data/schema";
import { consumeQuota } from "@/lib/auth/quotas";
import { explainError } from "@/lib/ai/features";

export const maxDuration = 60;
const BodySchema = z.object({ language: LanguageSchema, code: z.string().max(100_000), output: z.string().min(1).max(20_000) });

/** Explains a compile/runtime error in ≤ 120 words. Counted against the `hint3` quota (contextual help). */
export const POST = handler({ evt: "problems.explain", feature: "hint3", body: BodySchema }, async ({ user, body, params }) => {
  const p = await problems.resolve(params.id);
  if (!p || p.status === "draft") throw ApiError.notFound("Problem not found");
  await assertNotInActiveInterview(user.uid, p.id);
  const res = await explainError(p, body.language, body.code, body.output, user.uid);
  await consumeQuota(user.uid, "hint3");
  return { explanation: res.explanation, ...(user.isAdmin ? { costUsd: res.costUsd } : {}) };
});
