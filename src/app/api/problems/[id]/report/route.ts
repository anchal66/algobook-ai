import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import * as reports from "@/lib/data/reports";
import { ReportReasonSchema } from "@/lib/data/schema";

const BodySchema = z.object({ reason: ReportReasonSchema, details: z.string().max(2000).optional() });

/** Flags a problem; two distinct flags retire it (Module 02 stops serving retired problems). */
export const POST = handler({ evt: "problems.report", body: BodySchema }, async ({ user, params, body }) => {
  const p = await problems.resolve(params.id);
  if (!p) throw ApiError.notFound("Problem not found");
  if (await reports.existsForUser(p.id, user.uid)) throw ApiError.conflict("You already reported this problem");
  await reports.create({ problemId: p.id, uid: user.uid, reason: body.reason, details: body.details ?? null });
  const { count, retired } = await problems.incrementFlag(p.id, body.reason);
  return { ok: true, flagCount: count, retired };
});
