import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import { LanguageSchema } from "@/lib/data/schema";
import { ensureLanguage } from "@/lib/ai/drivers";
import { assertQuota, consumeQuota } from "@/lib/auth/quotas";

export const maxDuration = 120;
const BodySchema = z.object({ language: LanguageSchema, wait: z.boolean().optional() });

/** Ensures a verified driver exists for `language` (generate + verify on demand; idempotent). */
export const POST = handler({ evt: "problems.languages", body: BodySchema }, async ({ user, body, params }) => {
  const p = await problems.resolve(params.id);
  if (!p || p.status === "draft") throw ApiError.notFound("Problem not found");
  // On-demand driver generation costs an AI call and a judge batch: charge it to the `run` quota (admins exempt).
  const generates = !p.languages.includes(body.language);
  if (generates && !user.isAdmin) assertQuota(user.plan.tier, "run", user.quotas);
  const res = await ensureLanguage(p.id, body.language, { wait: body.wait ?? true, uid: user.uid });
  if (generates && !user.isAdmin && res.status !== "failed") await consumeQuota(user.uid, "run");
  if (res.status === "failed") throw new ApiError(409, "LANGUAGE_NOT_READY", res.error ?? `Could not prepare ${body.language} for this problem`);
  return { language: body.language, status: res.status, starter: res.starter ?? null };
});
