import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { sseResponse } from "@/lib/api/sse";
import * as problems from "@/lib/data/problems";
import * as cache from "@/lib/data/traceExplanations";
import { assertNotInActiveInterview } from "@/lib/practice/interview";
import { consumeQuota } from "@/lib/auth/quotas";
import { aiStream } from "@/lib/ai/client";
import { TRACE_EXPLAIN_INSTRUCTIONS, buildTraceExplainInput } from "@/lib/ai/prompts/trace";

export const maxDuration = 60;

const BodySchema = z.object({
  language: z.enum(["python", "javascript"]),
  code: z.string().min(1).max(100_000),
  caseInput: z.string().max(4000),
  expected: z.string().max(4000).optional(),
  question: z.enum(["step", "chapter", "failure"]),
  /** Compact textual rendering of the ±N steps around the cursor, built by the client (≤ 8 KB). */
  windowText: z.string().min(1).max(12_000),
});

/** Narrates a window of a real execution trace (Module 07 §3.6). SSE `delta` events then `done`. Quota `visualizeExplain`. */
export const POST = handler({ evt: "problems.trace_explain", feature: "visualizeExplain", body: BodySchema }, async ({ user, body, params }) => {
  const p = await problems.resolve(params.id);
  if (!p || p.status === "draft") throw ApiError.notFound("Problem not found");
  await assertNotInActiveInterview(user.uid, p.id);
  const key = cache.explanationKey([p.id, body.language, body.code, body.question, body.caseInput, body.windowText]);
  const cached = await cache.get(key);
  return sseResponse(async (send) => {
    if (cached) { send("delta", { text: cached.text }); send("done", { text: cached.text, cached: true }); return; }
    try {
      const input = buildTraceExplainInput({
        problem: { title: p.title, difficulty: p.difficulty, tags: p.tags, statementMd: p.statementMd, constraints: p.constraints, functionName: p.functionName, returnType: p.returnType, params: p.params },
        language: body.language, code: body.code, caseInput: body.caseInput, expected: body.expected, question: body.question, windowText: body.windowText,
      });
      const res = await aiStream({ purpose: "trace_explain", instructions: TRACE_EXPLAIN_INSTRUCTIONS, input, uid: user.uid, problemId: p.id }, (delta) => send("delta", { text: delta }));
      await Promise.all([consumeQuota(user.uid, "visualizeExplain"), cache.set(key, res.text, res.model, { problemId: p.id, uid: user.uid })]);
      send("done", { text: res.text, cached: false, ...(user.isAdmin ? { costUsd: res.costUsd } : {}) });
    } catch (e) {
      send("error", { code: "UPSTREAM", message: (e as Error)?.message ?? "Explanation failed" });
    }
  });
});
