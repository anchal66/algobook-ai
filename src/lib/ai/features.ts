import "server-only";
import type { Language, Project, Submission, WithId } from "@/lib/data/schema";
import * as problems from "@/lib/data/problems";
import * as submissions from "@/lib/data/submissions";
import * as projects from "@/lib/data/projects";
import { ApiError } from "@/lib/api/errors";
import { aiCall, aiStream } from "@/lib/ai/client";
import { EditorialSchema, InsightsSchema, ReviewSchema, type ChatTurn, type Editorial, type Insights } from "@/lib/ai/schemas";
import {
  CHAT_INSTRUCTIONS, COMPLETE_INSTRUCTIONS, EDITORIAL_INSTRUCTIONS, EXPLAIN_ERROR_INSTRUCTIONS, HINT3_INSTRUCTIONS, INSIGHTS_INSTRUCTIONS, REVIEW_INSTRUCTIONS,
  buildChatInput, buildCompleteInput, buildEditorialInput, buildExplainInput, buildHint3Input, buildInsightsInput, buildReviewInput, type ProblemSummaryInput,
} from "@/lib/ai/prompts";

/** Workspace AI features (Module 02 §3.4 / §3.7). Routes handle auth + quota; this file does the work. */

export const HINT_LABELS = ["Pattern Recognition", "Algorithm Choice", "Implementation Trap"] as const;

function summary(p: problems.ProblemPublic): ProblemSummaryInput {
  return { title: p.title, difficulty: p.difficulty, tags: p.tags, statementMd: p.statementMd, constraints: p.constraints, functionName: p.functionName, returnType: p.returnType, params: p.params };
}

// ── Hints ────────────────────────────────────────────────────────────────────

export interface HintResult { level: 1 | 2 | 3; label: string; text: string; source: "stored" | "contextual"; costUsd: number }

/** Levels 1–2 come from `content/hints`; level 3 is a contextual model call (stored hint 3 + the student's code). */
export async function getHint(p: problems.ProblemPublic, level: 1 | 2 | 3, opts: { code?: string; language: Language; uid: string }): Promise<HintResult> {
  const stored = await problems.getHints(p.id);
  if (!stored) throw ApiError.notFound("This problem has no hints yet");
  const h = stored.hints[level - 1];
  if (level < 3 || !opts.code?.trim()) return { level, label: h.label || HINT_LABELS[level - 1], text: h.text, source: "stored", costUsd: 0 };
  const res = await aiCall<string>({ purpose: "hint3", instructions: HINT3_INSTRUCTIONS, input: buildHint3Input(summary(p), h.text, opts.language, opts.code), uid: opts.uid, problemId: p.id });
  const text = res.text.trim() || h.text;
  return { level: 3, label: h.label || HINT_LABELS[2], text, source: "contextual", costUsd: res.costUsd };
}

// ── Editorial ────────────────────────────────────────────────────────────────

const editorialInFlight = new Map<string, Promise<Editorial & { model: string; cached: boolean; costUsd: number }>>();

/** Generated once per problem and shared (cached in `content/editorial`); concurrent requests share one call. */
export async function getOrCreateEditorial(p: problems.ProblemPublic, uid?: string): Promise<Editorial & { model: string; cached: boolean; costUsd: number }> {
  const existing = await problems.getEditorial(p.id);
  if (existing) return { overview: existing.overview, approaches: existing.approaches.map((a) => ({ ...a, code: { java: a.code.java ?? "", python: a.code.python ?? null } })), pitfalls: existing.pitfalls, model: existing.model, cached: true, costUsd: 0 };
  let job = editorialInFlight.get(p.id);
  if (!job) {
    job = (async () => {
      const tests = await problems.getPrivateTests(p.id);
      const javaRef = tests?.referenceSolution.java;
      if (!javaRef) throw ApiError.internal("Problem has no reference solution");
      const includePython = p.languages.includes("python");
      const res = await aiCall({ purpose: "editorial", schema: EditorialSchema, schemaName: "editorial", instructions: EDITORIAL_INSTRUCTIONS, input: buildEditorialInput(summary(p), javaRef, includePython, tests?.referenceSolution.python ?? null), uid, problemId: p.id });
      const approaches = res.data.approaches.map((a) => ({ title: a.title, intuition: a.intuition, algorithm: a.algorithm, time: a.time, space: a.space, code: { java: a.code.java, ...(a.code.python ? { python: a.code.python } : {}) } }));
      await problems.setEditorial(p.id, { overview: res.data.overview, approaches, pitfalls: res.data.pitfalls, model: res.model });
      return { ...res.data, model: res.model, cached: false, costUsd: res.costUsd };
    })().finally(() => editorialInFlight.delete(p.id));
    editorialInFlight.set(p.id, job);
  }
  return job;
}

// ── Review (post-AC) ─────────────────────────────────────────────────────────

export async function reviewSubmission(p: problems.ProblemPublic, sub: WithId<Submission>, uid: string) {
  if (sub.review) return { review: sub.review, cached: true, costUsd: 0 };
  if (sub.verdict !== "AC") throw ApiError.validation("Only accepted submissions can be reviewed");
  const res = await aiCall({ purpose: "review", schema: ReviewSchema, schemaName: "code_review", instructions: REVIEW_INSTRUCTIONS, input: buildReviewInput(p, sub.language, sub.code, sub.runtimeMs, sub.beatsRuntimePct), uid, problemId: p.id });
  const stored = await submissions.setReview(sub.id, res.data, res.model);
  return { review: stored, cached: false, costUsd: res.costUsd };
}

// ── Explain error ────────────────────────────────────────────────────────────

export async function explainError(p: problems.ProblemPublic, language: Language, code: string, output: string, uid: string): Promise<{ explanation: string; costUsd: number }> {
  const res = await aiCall<string>({ purpose: "explain", instructions: EXPLAIN_ERROR_INSTRUCTIONS, input: buildExplainInput(language, output, code), uid, problemId: p.id });
  return { explanation: res.text.trim(), costUsd: res.costUsd };
}

// ── Tutor chat (streaming) ───────────────────────────────────────────────────

export async function streamChat(p: problems.ProblemPublic, o: { uid: string; language: Language; code?: string; turns: ChatTurn[] }, onDelta: (d: string) => void) {
  const solved = await submissions.hasAccepted(o.uid, p.id);
  return aiStream({ purpose: "chat", instructions: CHAT_INSTRUCTIONS, input: buildChatInput({ problem: summary(p), language: o.language, code: o.code, solved, turns: o.turns }), uid: o.uid, problemId: p.id }, onDelta);
}

// ── Inline completion ────────────────────────────────────────────────────────

export async function completeCode(o: { uid: string; language: Language; prefix: string; suffix: string; problemId?: string }): Promise<{ text: string; costUsd: number }> {
  const res = await aiCall<string>({ purpose: "complete", instructions: COMPLETE_INSTRUCTIONS, input: buildCompleteInput(o.language, o.prefix, o.suffix), uid: o.uid, problemId: o.problemId, promptCacheKey: `algobook:complete:${o.uid}` });
  let text = res.text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/i, "");
  const lines = text.split("\n");
  if (lines.length > 6) text = lines.slice(0, 6).join("\n");
  return { text, costUsd: res.costUsd };
}

// ── Project insights ─────────────────────────────────────────────────────────

export async function generateInsights(project: WithId<Project>, uid: string): Promise<{ insights: Insights; costUsd: number }> {
  const res = await aiCall({
    purpose: "insights", schema: InsightsSchema, schemaName: "project_insights", instructions: INSIGHTS_INSTRUCTIONS,
    input: buildInsightsInput({ title: project.title, description: project.description, purpose: project.purpose, durationDays: project.durationDays, experienceLevel: project.experienceLevel, goalType: project.goalType, templateId: project.templateId, selectedTopics: project.selectedTopics, progress: project.progress }),
    uid,
  });
  const data = res.data;
  data.totalRecommended = data.easyCount + data.mediumCount + data.hardCount;
  await projects.setInsights(project.id, { ...data, model: res.model });
  return { insights: data, costUsd: res.costUsd };
}
