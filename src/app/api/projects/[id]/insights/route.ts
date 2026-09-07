import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as projects from "@/lib/data/projects";
import { generateInsights } from "@/lib/ai/features";

export const maxDuration = 60;
const FRESH_MS = 10 * 60_000;
const BodySchema = z.object({ force: z.boolean().optional() });

/** Creates (or regenerates) the AI study plan stored on `projects.insights`. Cached for 10 minutes unless `force`. */
export const POST = handler({ evt: "projects.insights", body: BodySchema }, async ({ user, body, params }) => {
  const project = await projects.getOwned(params.id, user.uid);
  const existing = project.insights as (Record<string, unknown> & { generatedAt?: { toMillis(): number } }) | null;
  const generatedAt = existing?.generatedAt && typeof existing.generatedAt.toMillis === "function" ? existing.generatedAt.toMillis() : 0;
  if (existing && !body.force && Date.now() - generatedAt < FRESH_MS) {
    const { generatedAt: _g, ...rest } = existing;
    return { insights: rest, cached: true };
  }
  const { insights, costUsd } = await generateInsights(project, user.uid);
  return { insights, cached: false, ...(user.isAdmin ? { costUsd } : {}) };
});
