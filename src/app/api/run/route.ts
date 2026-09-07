import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import * as activity from "@/lib/data/activity";
import { consumeQuota } from "@/lib/auth/quotas";
import { LanguageSchema, todayKey } from "@/lib/data/schema";
import { runCases } from "@/lib/judge/service";

export const maxDuration = 60;

const BodySchema = z.object({
  problemId: z.string().min(1),
  language: LanguageSchema,
  code: z.string().max(100_000),
  cases: z.array(z.object({ input: z.string().max(65_536), expected: z.string().max(65_536).optional() })).min(1).max(6),
});

/** Runs up to 6 cases (samples with `expected`, custom ones without) in one Judge0 batch. */
export const POST = handler({ evt: "run", feature: "run", body: BodySchema }, async ({ user, body }) => {
  const p = await problems.resolve(body.problemId);
  if (!p) throw ApiError.notFound("Problem not found");
  if (!p.languages.includes(body.language)) throw new ApiError(409, "LANGUAGE_NOT_READY", `${body.language} is not available for this problem yet`);
  const drivers = await problems.getDrivers(p.id);
  if (!drivers) throw ApiError.internal("Problem has no drivers");

  const started = Date.now();
  const cases = await runCases(
    { id: p.id, checker: p.checker, limits: p.limits, sampleTests: p.sampleTests, hiddenTests: [], drivers: drivers.drivers },
    body.language, body.code, body.cases,
  );
  await Promise.all([
    consumeQuota(user.uid, "run"),
    activity.recordSubmit(user.uid, todayKey(), { runs: 1 }),
  ]);
  console.info(JSON.stringify({ evt: "run.done", uid: user.uid, problemId: p.id, language: body.language, cases: cases.length, judgeMs: Date.now() - started }));
  return { cases };
});
