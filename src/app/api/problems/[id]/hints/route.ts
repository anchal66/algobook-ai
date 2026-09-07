import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import { LanguageSchema } from "@/lib/data/schema";
import { assertQuota, consumeQuota } from "@/lib/auth/quotas";
import { getHint } from "@/lib/ai/features";

const BodySchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  code: z.string().max(100_000).optional(),
  language: LanguageSchema.optional(),
});

/** Levels 1–2: stored, any plan. Level 3: contextual (uses the student's code) — `hint3` quota (pro). */
export const POST = handler({ evt: "problems.hints", body: BodySchema }, async ({ user, body, params }) => {
  const p = await problems.resolve(params.id);
  if (!p || p.status === "draft") throw ApiError.notFound("Problem not found");
  if (body.level === 3) assertQuota(user.plan.tier, "hint3", user.quotas);
  const hint = await getHint(p, body.level, { code: body.code, language: body.language ?? user.doc.settings.editor.language, uid: user.uid });
  if (hint.source === "contextual") await consumeQuota(user.uid, "hint3");
  return { level: hint.level, label: hint.label, text: hint.text, source: hint.source, ...(user.isAdmin ? { costUsd: hint.costUsd } : {}) };
});
