import { after } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { sseResponse } from "@/lib/api/sse";
import { adminDb } from "@/lib/firebase-admin";
import * as projects from "@/lib/data/projects";
import { serialize, type Language } from "@/lib/data/schema";
import { assertQuota, consumeQuota } from "@/lib/auth/quotas";
import { recommend, summarizeForPrompt, getSeenProblemIds } from "@/lib/practice";
import { generateVerifiedProblem, GenerationFailed, type GenerationContext } from "@/lib/ai/generate";
import { fanOutLanguages } from "@/lib/ai/drivers";
import { sanitizeUserPrompt } from "@/lib/ai/sanitize";

/** Recommend → reuse-or-generate (verified) → link to the project (Module 02 §3.9). D-14: long-running. */
export const maxDuration = 300;

const BodySchema = z.object({
  userPrompt: z.string().max(300).optional(),
  stream: z.boolean().optional(),
  language: z.enum(["java", "python", "cpp", "javascript"]).optional(),
  /** Module 04 P-16: client session-health score (0–100); the server clamps its effect to ±1 difficulty level. */
  sessionHealthScore: z.number().min(0).max(100).optional(),
  /** Module 04: restrict the recommendation to these topics (canonical or alias names). */
  topicFilter: z.array(z.string().max(40)).max(10).optional(),
});
const QuerySchema = z.object({ stream: z.string().optional() });

function errorBody(e: unknown) {
  if (e instanceof GenerationFailed) return { code: "UPSTREAM", status: 503, message: "We couldn't produce a verified problem right now. Please try again in a moment.", details: { attempts: e.attempts, errors: e.errors } };
  if (e instanceof ApiError) return { code: e.code, status: e.status, message: e.message, details: e.details };
  console.error(JSON.stringify({ evt: "projects.next.error", message: (e as Error)?.message, stack: (e as Error)?.stack }));
  return { code: "INTERNAL", status: 500, message: "Unexpected error" };
}

export const POST = handler({ evt: "projects.next", body: BodySchema, query: QuerySchema }, async ({ user, body, query, params }) => {
  const project = await projects.getOwned(params.id, user.uid);
  const items = await projects.getItems(project.id);
  const userPrompt = sanitizeUserPrompt(body.userPrompt) || undefined;
  const [rec, seen] = await Promise.all([
    recommend({ uid: user.uid, user: user.doc, project, existingItems: items, userPrompt, topicFilter: body.topicFilter, sessionHealthScore: body.sessionHealthScore }),
    getSeenProblemIds(user.uid),
  ]);
  // Returning user (≥ 14 idle days): enter the 3-step calibration; `/api/submit` advances and completes it.
  if (rec.startCalibration) await adminDb.collection("users").doc(user.uid).update({ calibration: { complete: false, step: 0 } });
  const lang: Language = body.language ?? user.doc.settings.editor.language;

  // Fan-out runs after the response is sent; resolved with the new problem id (or null).
  let resolveFanOut: (id: string | null) => void = () => undefined;
  const fanOut = new Promise<string | null>((r) => { resolveFanOut = r; });
  after(async () => {
    const id = await fanOut;
    if (id) await fanOutLanguages(id, undefined, user.uid);
  });

  const run = async (onStage?: GenerationContext["onStage"]) => {
    const ctx: GenerationContext = {
      uid: user.uid, projectId: project.id, recommendation: rec, profileSummary: summarizeForPrompt(user.doc),
      recentTitles: items.slice(-12).map((i) => i.title), userPrompt, experienceLevel: project.experienceLevel, goalType: project.goalType,
      projectDescription: project.description, seenProblemIds: seen, userRating: user.doc.stats.rating,
      beforeGenerate: () => { assertQuota(user.plan.tier, "generate", user.quotas); },
      onStage,
    };
    let out;
    try {
      out = await generateVerifiedProblem(ctx);
    } finally {
      // nothing generated → no fan-out
    }
    const item = await projects.addItem(project.id, {
      problemId: out.problemId, title: out.problem.title, difficulty: out.problem.difficulty, tags: out.problem.tags,
      reason: rec.reason, source: out.source === "reused" ? "curated" : out.problem.source,
    });
    if (rec.templateEntry) await projects.markPoolUsed(project.id, rec.templateEntry.id, out.problemId).catch(() => undefined);
    if (out.source === "generated") {
      await consumeQuota(user.uid, "generate");
      resolveFanOut(out.problemId);
    } else {
      resolveFanOut(null);
    }
    const p = out.problem;
    return {
      item: serialize(item),
      problem: serialize({ ...p, starter: { [lang]: p.starter[lang] ?? "" } }),
      languages: (["java", "python", "cpp", "javascript"] as Language[]).map((key) => ({ key, ready: p.languages.includes(key) })),
      reason: rec.reason,
      rationale: rec.rationaleFacts,
      practiceState: rec.state,
      strategy: rec.strategy,
      isCalibration: rec.isCalibration,
      sessionMessage: rec.sessionMessage,
      source: out.source,
      attempts: out.attempts,
      latencyMs: out.latencyMs,
      ...(user.isAdmin ? { costUsd: out.costUsd } : {}),
    };
  };

  const wantsStream = body.stream === true || query.stream === "1" || query.stream === "true";
  if (!wantsStream) {
    try { return await run(); } catch (e) { resolveFanOut(null); if (e instanceof GenerationFailed) { const b = errorBody(e); throw new ApiError(503, "UPSTREAM", b.message, b.details); } throw e; }
  }
  return sseResponse(async (send) => {
    try {
      const result = await run((stage, info) => send("stage", { stage, ...(info ?? {}) }));
      send("done", result);
    } catch (e) {
      resolveFanOut(null);
      send("error", errorBody(e));
    }
  });
});
