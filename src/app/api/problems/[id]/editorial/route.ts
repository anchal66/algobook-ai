import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import { consumeQuota } from "@/lib/auth/quotas";
import { getOrCreateEditorial } from "@/lib/ai/features";

export const maxDuration = 120;

/** AI editorial: generated once per problem (lazily), cached, pro-only (D-04/D-10). */
export const GET = handler({ evt: "problems.editorial", feature: "editorial" }, async ({ user, params }) => {
  const p = await problems.resolve(params.id);
  if (!p || p.status === "draft") throw ApiError.notFound("Problem not found");
  const ed = await getOrCreateEditorial(p, user.uid);
  await consumeQuota(user.uid, "editorial");
  return { editorial: { overview: ed.overview, approaches: ed.approaches, pitfalls: ed.pitfalls, model: ed.model }, cached: ed.cached, ...(user.isAdmin ? { costUsd: ed.costUsd } : {}) };
});
