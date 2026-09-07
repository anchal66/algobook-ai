import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { LanguageSchema } from "@/lib/data/schema";
import { consumeQuota } from "@/lib/auth/quotas";
import { completeCode } from "@/lib/ai/features";

export const maxDuration = 30;
const BodySchema = z.object({
  language: LanguageSchema,
  prefix: z.string().max(40_000),
  suffix: z.string().max(10_000).default(""),
  problemId: z.string().optional(),
});

/** Inline ghost-text completion (`reasoning: none`, ≤ 96 tokens). Client debounces 600 ms (Module 03). */
export const POST = handler({ evt: "ai.complete", feature: "completion", body: BodySchema }, async ({ user, body }) => {
  const res = await completeCode({ uid: user.uid, ...body });
  await consumeQuota(user.uid, "completion");
  return { text: res.text, ...(user.isAdmin ? { costUsd: res.costUsd } : {}) };
});
