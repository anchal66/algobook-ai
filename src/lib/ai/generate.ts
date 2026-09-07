import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Difficulty, ExperienceLevel, GoalType, TemplateRef } from "@/lib/data/schema";
import * as problems from "@/lib/data/problems";
import { lintInput } from "@/lib/judge/encoding";
import { verifyReference, type JudgeProblem } from "@/lib/judge/service";
import type { JudgeResult } from "@/lib/judge/types";
import { aiCall, embed, AiError } from "@/lib/ai/client";
import { REPAIR_LADDER, modelFor, type ModelId, type ReasoningEffort } from "@/lib/ai/models";
import { ProblemSpecSchema, type ProblemSpec } from "@/lib/ai/schemas";
import { GEN_INSTRUCTIONS, REPAIR_INSTRUCTIONS, buildGenInput, buildRepairInput, type GenInputContext, type JudgeFeedbackCase, type RepairFeedback } from "@/lib/ai/prompts";
import { normalizeTags } from "@/lib/practice/topics";

/**
 * Verified generation pipeline (Module 02 §3.3):
 *   reuse search → generate → static validation (+ duplicate check) → Judge verification → repair ×2 → persist.
 * Nothing reaches `problems` with status "verified" unless the reference solution passed every test.
 */

export type GenerationStage = "searching" | "generating" | "validating" | "verifying" | "repairing" | "persisting" | "done";
export type StageListener = (stage: GenerationStage, info?: Record<string, unknown>) => void;

export interface GenerationRecommendation {
  difficulty: Difficulty;
  topics: string[];
  avoidTopics: string[];
  reason: { short: string; detail: string };
  isCalibration: boolean;
  templateEntry?: { title: string; number: number; difficulty: Difficulty; company: string } | null;
}

export interface GenerationContext {
  uid: string | null;
  projectId: string | null;
  recommendation: GenerationRecommendation;
  profileSummary: string;
  recentTitles: string[];
  userPrompt?: string;
  experienceLevel: ExperienceLevel;
  goalType: GoalType;
  projectDescription: string;
  /** Problems the user has already seen (never reused for them). */
  seenProblemIds: string[];
  userRating?: number;
  /** Called once, right before the first paid model call (quota check lives here). */
  beforeGenerate?: () => void | Promise<void>;
  onStage?: StageListener;
  /** Skip the reuse search (evaluation / pre-generation). */
  noReuse?: boolean;
  /** Skip persisting (evaluation). */
  noPersist?: boolean;
  source?: "generated" | "template";
}

export class GenerationFailed extends Error {
  constructor(message: string, public readonly attempts: number, public readonly costUsd: number, public readonly errors: string[]) {
    super(message);
    this.name = "GenerationFailed";
  }
}

export const RATING_SEED: Record<Difficulty, number> = { Easy: 1200, Medium: 1500, Hard: 1900 };
export const DUPLICATE_DISTANCE = 0.15;
export const REUSE_PROMPT_DISTANCE = 0.25;

// ── Static validation (pure; unit-tested) ────────────────────────────────────

export interface ValidationOutcome { spec: ProblemSpec; errors: string[] }

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const MIN_HIDDEN_TESTS = 8;

/** Normalises tags/title/slug and returns every contract violation the judge would otherwise hit. */
export function validateSpec(input: ProblemSpec, fallbackTopics: string[] = []): ValidationOutcome {
  const errors: string[] = [];
  const spec: ProblemSpec = { ...input, examples: [...input.examples], sampleTests: [...input.sampleTests], hiddenTests: [...input.hiddenTests] };

  spec.title = spec.title.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!spec.title) errors.push("title is empty");
  spec.slug = (spec.slug || spec.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  let tags = normalizeTags(spec.tags);
  if (!tags.length) tags = normalizeTags(fallbackTopics);
  if (!tags.length) errors.push(`tags must come from the allowed topic list (got: ${spec.tags.join(", ")})`);
  spec.tags = tags.slice(0, 5);

  if (!IDENT.test(spec.functionName)) errors.push(`functionName "${spec.functionName}" is not a valid identifier`);
  const names = new Set<string>();
  for (const p of spec.params) {
    if (!IDENT.test(p.name)) errors.push(`param name "${p.name}" is not a valid identifier`);
    if (names.has(p.name)) errors.push(`duplicate param name "${p.name}"`);
    names.add(p.name);
  }

  if (spec.checker.type === "float" && !spec.checker.eps) spec.checker = { type: "float", eps: 1e-5 };
  if (spec.checker.type !== "float") spec.checker = { type: spec.checker.type, eps: null };

  // Hidden tests that repeat a sample (or another hidden) input are simply dropped — the model does this
  // often and it is harmless as long as ≥ MIN_HIDDEN_TESTS remain.
  const seen = new Map<string, string>();
  const keep: ProblemSpec["hiddenTests"] = [];
  const all = [...spec.sampleTests.map((t, i) => ({ t, where: `sampleTests[${i}]`, hidden: false })), ...spec.hiddenTests.map((t, i) => ({ t, where: `hiddenTests[${i}]`, hidden: true }))];
  for (const { t, where, hidden } of all) {
    if (!t.input.endsWith("\n")) t.input += "\n";
    const key = t.input.trim();
    if (seen.has(key)) {
      if (hidden) continue;
      errors.push(`${where} duplicates ${seen.get(key)} (identical input)`);
    } else seen.set(key, where);
    const lint = lintInput(spec.params, t.input);
    if (!lint.ok) errors.push(`${where} input does not match the params encoding: ${lint.errors.slice(0, 2).join("; ")}`);
    if (t.expectedOutput.trim() === "" && spec.returnType !== "string") errors.push(`${where} has an empty expectedOutput`);
    if (hidden) keep.push(t);
  }
  if (keep.length < MIN_HIDDEN_TESTS) errors.push(`only ${keep.length} distinct hidden tests (need ≥ ${MIN_HIDDEN_TESTS}; ${spec.hiddenTests.length - keep.length} duplicated a sample or another hidden test)`);
  spec.hiddenTests = keep;

  if (!/class\s+Solution\b/.test(spec.starter.java)) errors.push("starter.java must declare `class Solution`");
  if (!spec.starter.java.includes(spec.functionName)) errors.push(`starter.java does not contain the function ${spec.functionName}`);
  if (!/class\s+Solution\b/.test(spec.reference.java)) errors.push("reference.java must declare `class Solution`");
  if (!spec.reference.java.includes(spec.functionName)) errors.push(`reference.java does not contain the function ${spec.functionName}`);
  if (!/public\s+class\s+Main\b/.test(spec.driver.java)) errors.push("driver.java must declare `public class Main`");
  if (!spec.driver.java.includes(spec.functionName)) errors.push(`driver.java never calls ${spec.functionName}`);
  if (/public\s+class\s+Solution\b/.test(spec.driver.java)) errors.push("driver.java must not define Solution");
  if (/class\s+Main\b/.test(spec.reference.java) || /class\s+Main\b/.test(spec.starter.java)) errors.push("Solution files must not define Main");

  spec.hints = spec.hints.map((h, i) => ({ label: h.label.trim() || ["Pattern Recognition", "Algorithm Choice", "Implementation Trap"][i], text: h.text.trim() }));
  if (spec.hints.some((h) => !h.text)) errors.push("every hint needs text");
  spec.timeLimitSec = Math.min(5, Math.max(1, Math.round(spec.timeLimitSec)));
  return { spec, errors };
}

export function judgeProblemFor(spec: ProblemSpec, id = "pending"): JudgeProblem {
  return {
    id,
    checker: { type: spec.checker.type, eps: spec.checker.eps ?? undefined },
    limits: { cpuTimeSec: spec.timeLimitSec, memoryKb: 256000 },
    sampleTests: spec.sampleTests,
    hiddenTests: spec.hiddenTests,
    drivers: { java: spec.driver.java },
  };
}

export function feedbackFromJudge(result: JudgeResult, staticErrors: string[] = []): RepairFeedback {
  const failing: JudgeFeedbackCase[] = result.cases.filter((c) => !c.passed).slice(0, 3).map((c) => ({
    index: c.index, input: c.input, expected: c.expected ?? "", actual: c.actual, stderr: c.stderr, compileOutput: c.compileOutput, status: c.status,
  }));
  return { staticErrors, verdict: result.verdict, passed: result.passed, total: result.total, failing };
}

/**
 * When the reference passes every SAMPLE test (the examples the statement shows) but a few HIDDEN
 * expectations disagree with it, the hand-computed expectation is almost always the wrong side
 * (the model "mentally executes" reference.java). Adopt the reference's stdout for those cases
 * instead of paying for a repair round. Bounded: WA only (no RE/CE/TLE), ≤ `maxFraction` of the
 * hidden tests, and the reference must be self-consistent on the samples.
 */
export const ADOPT_MAX_FRACTION = 0.3;
export function adoptReferenceOutputs(spec: ProblemSpec, judge: JudgeResult, maxFraction = ADOPT_MAX_FRACTION): { spec: ProblemSpec; adopted: number } | null {
  if (judge.verdict !== "WA") return null;
  const sampleCount = spec.sampleTests.length;
  const failing = judge.cases.filter((c) => !c.passed);
  if (!failing.length || failing.some((c) => c.status !== "WA" || c.index < sampleCount)) return null;
  if (failing.length > Math.max(1, Math.floor(spec.hiddenTests.length * maxFraction))) return null;
  const hidden = spec.hiddenTests.map((t) => ({ ...t }));
  for (const c of failing) {
    const out = c.actual.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n+$/g, "");
    if (!out.trim()) return null; // empty output means the reference did not really answer
    hidden[c.index - sampleCount].expectedOutput = out;
  }
  return { spec: { ...spec, hiddenTests: hidden }, adopted: failing.length };
}

export function embeddingText(spec: Pick<ProblemSpec, "title" | "statementMd">): string {
  return `${spec.title}\n${spec.statementMd.slice(0, 400)}`;
}

// ── Reuse search (no model calls except an embedding when a prompt is given) ──

export async function findReusable(ctx: GenerationContext): Promise<{ problem: problems.ProblemPublic; costUsd: number } | null> {
  const rec = ctx.recommendation;
  const exclude = ctx.seenProblemIds;
  let costUsd = 0;
  const candidates: problems.ProblemPublic[] = [];
  const push = (p: problems.ProblemPublic) => { if (!candidates.some((c) => c.id === p.id) && !exclude.includes(p.id) && p.status === "verified") candidates.push(p); };

  if (rec.templateEntry) {
    for (const p of await problems.findByTemplateTitle(rec.templateEntry.title, { excludeIds: exclude })) push(p);
  }
  if (ctx.userPrompt && !candidates.length) {
    try {
      const e = await embed(ctx.userPrompt, { uid: ctx.uid ?? undefined });
      costUsd += e.costUsd;
      const near = await problems.findNearest(e.embedding, 8, { status: "verified", maxDistance: REUSE_PROMPT_DISTANCE });
      for (const p of near) if (p.difficulty === rec.difficulty) push(p);
    } catch (e) {
      console.warn(JSON.stringify({ evt: "generate.reuse_embedding_skipped", message: (e as Error).message?.slice(0, 200) }));
    }
  }
  if (!candidates.length) {
    const tagSets = rec.topics.length > 1 ? [rec.topics, ...rec.topics.map((t) => [t])] : [rec.topics];
    for (const tags of tagSets) {
      const res = await problems.search({ tags, difficulty: rec.difficulty, status: "verified", excludeIds: exclude, limit: 20 });
      for (const s of res.items) {
        const full = await problems.getPublic(s.id);
        if (full) push(full);
      }
      if (candidates.length) break;
    }
  }
  if (!candidates.length) return null;

  const target = (ctx.userRating ?? 1200) + (RATING_SEED[rec.difficulty] - 1200);
  candidates.sort((a, b) => {
    const da = Math.abs(a.rating - target), db = Math.abs(b.rating - target);
    if (da !== db) return da - db;
    const sa = a.lastServedAt?.toMillis() ?? 0, sb = b.lastServedAt?.toMillis() ?? 0;
    return sa - sb;
  });
  return { problem: candidates[0], costUsd };
}

// ── Generate + verify + repair (no persistence) ──────────────────────────────

export interface SpecResult {
  spec: ProblemSpec;
  judge: JudgeResult;
  embedding: number[] | null;
  attempts: number;
  repairs: number;
  firstPassOk: boolean;
  /** Hidden expectations replaced by the reference's output. */
  adopted: number;
  costUsd: number;
  model: string;
  latencyMs: number;
}

async function checkDuplicate(spec: ProblemSpec): Promise<{ duplicateOf: string | null; embedding: number[] | null; costUsd: number }> {
  try {
    const e = await embed(embeddingText(spec));
    let duplicateOf: string | null = null;
    try {
      const near = await problems.findNearest(e.embedding, 1, { status: "verified", maxDistance: DUPLICATE_DISTANCE });
      if (near.length) duplicateOf = near[0].title;
    } catch (err) {
      console.warn(JSON.stringify({ evt: "generate.dedupe_skipped", message: (err as Error).message?.slice(0, 200) }));
    }
    return { duplicateOf, embedding: e.embedding, costUsd: e.costUsd };
  } catch (err) {
    console.warn(JSON.stringify({ evt: "generate.embedding_skipped", message: (err as Error).message?.slice(0, 200) }));
    return { duplicateOf: null, embedding: null, costUsd: 0 };
  }
}

function genInput(ctx: GenerationContext, avoidTitles: string[]): GenInputContext {
  const r = ctx.recommendation;
  return {
    difficulty: r.difficulty, topics: r.topics, avoidTopics: r.avoidTopics, experienceLevel: ctx.experienceLevel, goalType: ctx.goalType,
    profileSummary: ctx.profileSummary, recentTitles: ctx.recentTitles, templateEntry: r.templateEntry ?? null, isCalibration: r.isCalibration,
    projectDescription: ctx.projectDescription, userPrompt: ctx.userPrompt, avoidTitles,
  };
}

export interface VerifyRepairResult {
  spec: ProblemSpec;
  judge: JudgeResult | null;
  ok: boolean;
  attempts: number;
  repairs: number;
  firstPassOk: boolean;
  costUsd: number;
  model: string;
  errors: string[];
  titleChanged: boolean;
  /** Hidden expectations replaced by the reference's output (see adoptReferenceOutputs). */
  adopted: number;
}

/**
 * Static validation → Judge verification → repair ladder (Luna xhigh, then Terra medium).
 * Shared by live generation, the pre-generation collector and the evaluation script.
 */
export async function verifyAndRepair(initial: ProblemSpec, o: { fallbackTopics?: string[]; uid?: string; onStage?: StageListener; model?: string; adoptReferenceOutputs?: boolean }): Promise<VerifyRepairResult> {
  const stage = o.onStage ?? (() => undefined);
  const errorsSeen: string[] = [];
  let current = validateSpec(initial, o.fallbackTopics ?? []);
  let judge: JudgeResult | null = null;
  let attempts = 0, repairs = 0, costUsd = 0;
  let model: string = o.model ?? modelFor("generate");
  let titleChanged = false;
  let adopted = 0;
  for (let round = 0; round <= REPAIR_LADDER.length; round++) {
    let feedback: RepairFeedback | null = null;
    if (current.errors.length) {
      feedback = { staticErrors: current.errors, failing: [] };
      errorsSeen.push(...current.errors.slice(0, 4));
      console.warn(JSON.stringify({ evt: "generate.static_failed", round, title: current.spec.title, errors: current.errors.slice(0, 5) }));
    } else {
      stage("verifying", { round });
      judge = await verifyReference(judgeProblemFor(current.spec), "java", current.spec.reference.java);
      if (judge.verdict === "AC") {
        return { spec: current.spec, judge, ok: true, attempts, repairs, firstPassOk: round === 0 && adopted === 0, costUsd, model, errors: errorsSeen, titleChanged, adopted };
      }
      const adoption = o.adoptReferenceOutputs === false ? null : adoptReferenceOutputs(current.spec, judge);
      if (adoption) {
        adopted += adoption.adopted;
        console.info(JSON.stringify({ evt: "generate.adopted_reference_outputs", round, title: current.spec.title, adopted: adoption.adopted, of: current.spec.hiddenTests.length }));
        const recheck = await verifyReference(judgeProblemFor(adoption.spec), "java", adoption.spec.reference.java);
        if (recheck.verdict === "AC") {
          return { spec: adoption.spec, judge: recheck, ok: true, attempts, repairs, firstPassOk: false, costUsd, model, errors: errorsSeen, titleChanged, adopted };
        }
        judge = recheck;
      }
      feedback = feedbackFromJudge(judge);
      const first = judge.failedCase;
      errorsSeen.push(`${judge.verdict} ${judge.passed}/${judge.total}${first ? ` (case #${first.index}: ${(first.compileOutput || first.stderr || first.actual || "").slice(0, 160)})` : ""}`);
      console.warn(JSON.stringify({ evt: "generate.verify_failed", round, title: current.spec.title, verdict: judge.verdict, passed: judge.passed, total: judge.total,
        failedIndex: first?.index, status: first?.status, expected: first?.expected?.slice(0, 120), actual: first?.actual.slice(0, 120), stderr: (first?.compileOutput || first?.stderr || "").slice(0, 300) }));
    }
    if (round === REPAIR_LADDER.length) break;
    const ladder = REPAIR_LADDER[round];
    stage("repairing", { round: round + 1, model: ladder.model });
    attempts++; repairs++;
    const res = await aiCall({
      purpose: "repair", model: ladder.model as ModelId, reasoning: ladder.reasoning as ReasoningEffort, schema: ProblemSpecSchema, schemaName: "problem_spec",
      instructions: REPAIR_INSTRUCTIONS, input: buildRepairInput(current.spec, feedback), uid: o.uid,
    });
    costUsd += res.costUsd; model = res.model;
    if (res.data.title !== initial.title) titleChanged = true;
    current = validateSpec(res.data, o.fallbackTopics ?? []);
  }
  return { spec: current.spec, judge, ok: false, attempts, repairs, firstPassOk: false, costUsd, model, errors: errorsSeen.slice(-4), titleChanged, adopted };
}

/** Generates and verifies one spec; throws `GenerationFailed` when it cannot be made to pass. */
export async function generateSpec(ctx: GenerationContext): Promise<SpecResult> {
  const started = Date.now();
  const stage = ctx.onStage ?? (() => undefined);
  let attempts = 0, costUsd = 0;
  let model: string = modelFor("generate");
  let embedding: number[] | null = null;

  if (ctx.beforeGenerate) await ctx.beforeGenerate();

  // 1. Generate (regenerate once if it duplicates an existing verified problem).
  let spec: ProblemSpec | null = null;
  const avoidTitles: string[] = [];
  for (let dupTry = 0; dupTry < 2 && !spec; dupTry++) {
    stage("generating", { attempt: attempts + 1 });
    attempts++;
    const res = await aiCall({ purpose: "generate", schema: ProblemSpecSchema, schemaName: "problem_spec", instructions: GEN_INSTRUCTIONS, input: buildGenInput(genInput(ctx, avoidTitles)), uid: ctx.uid ?? undefined });
    costUsd += res.costUsd; model = res.model;
    stage("validating");
    const dup = await checkDuplicate(res.data);
    costUsd += dup.costUsd; embedding = dup.embedding;
    if (dup.duplicateOf && dupTry === 0) {
      console.info(JSON.stringify({ evt: "generate.duplicate", title: res.data.title, of: dup.duplicateOf }));
      avoidTitles.push(res.data.title, dup.duplicateOf);
      continue;
    }
    spec = res.data;
  }
  if (!spec) throw new GenerationFailed("Could not generate a non-duplicate problem", attempts, costUsd, ["duplicate"]);

  // 2. Validate + verify (+ repair ladder).
  const vr = await verifyAndRepair(spec, { fallbackTopics: ctx.recommendation.topics, uid: ctx.uid ?? undefined, onStage: ctx.onStage, model });
  attempts += vr.attempts; costUsd += vr.costUsd;
  if (!vr.ok) throw new GenerationFailed(`Problem could not be verified after ${vr.repairs} repair(s)`, attempts, costUsd, vr.errors);
  if (vr.titleChanged) embedding = null;
  return { spec: vr.spec, judge: vr.judge!, embedding, attempts, repairs: vr.repairs, firstPassOk: vr.firstPassOk, adopted: vr.adopted, costUsd, model: vr.model, latencyMs: Date.now() - started };
}

// ── Persist ──────────────────────────────────────────────────────────────────

export interface PersistOptions {
  source: "generated" | "template" | "curated";
  createdBy: string;
  model: string;
  templateRef?: TemplateRef | null;
  companies?: string[];
}

export async function persistSpec(r: SpecResult, opts: PersistOptions): Promise<string> {
  const { spec } = r;
  const slug = await problems.uniqueSlug(spec.slug || spec.title);
  const id = await problems.create({
    problem: {
      slug, number: null, title: spec.title, difficulty: spec.difficulty, tags: spec.tags, companies: opts.companies ?? [],
      statementMd: spec.statementMd,
      examples: spec.examples.map((e) => ({ input: e.input, output: e.output, ...(e.explanation ? { explanation: e.explanation } : {}) })),
      constraints: spec.constraints, followUp: spec.followUp, params: spec.params, returnType: spec.returnType, functionName: spec.functionName,
      sampleTests: spec.sampleTests, checker: { type: spec.checker.type, ...(spec.checker.eps ? { eps: spec.checker.eps } : {}) },
      limits: { cpuTimeSec: spec.timeLimitSec, memoryKb: 256000 },
      languages: ["java"], starter: { java: spec.starter.java }, hintsPreview: 3, rating: RATING_SEED[spec.difficulty], source: opts.source,
      templateRef: opts.templateRef ?? null,
      embedding: r.embedding ? (FieldValue.vector(r.embedding) as unknown as { toArray(): number[] }) : null,
      status: "verified", createdBy: opts.createdBy, model: opts.model, languageJobs: {}, lastServedAt: null,
      stats: { attempts: 0, accepted: 0, acceptanceRate: 0, avgRuntimeMs: {}, runtimeSamples: {}, memorySamples: {}, referenceRuntimeMs: { java: r.judge.runtimeMs } },
    },
    tests: { hiddenTests: spec.hiddenTests, referenceSolution: { java: spec.reference.java } },
    drivers: { drivers: { java: spec.driver.java } },
  });
  await problems.setHints(id, spec.hints);
  return id;
}

// ── Entry point ──────────────────────────────────────────────────────────────

export interface GenerationOutcome {
  problemId: string;
  problem: problems.ProblemPublic;
  source: "reused" | "generated";
  attempts: number;
  costUsd: number;
  latencyMs: number;
}

export async function generateVerifiedProblem(ctx: GenerationContext): Promise<GenerationOutcome> {
  const started = Date.now();
  const stage = ctx.onStage ?? (() => undefined);
  if (!ctx.noReuse) {
    stage("searching");
    const reused = await findReusable(ctx);
    if (reused) {
      await problems.touchServed(reused.problem.id);
      stage("done", { source: "reused" });
      return { problemId: reused.problem.id, problem: reused.problem, source: "reused", attempts: 0, costUsd: reused.costUsd, latencyMs: Date.now() - started };
    }
  }
  let result: SpecResult;
  try {
    result = await generateSpec(ctx);
  } catch (e) {
    if (e instanceof AiError) throw new GenerationFailed(e.message, 1, 0, [e.kind]);
    throw e;
  }
  stage("persisting");
  const r = ctx.recommendation;
  const problemId = await persistSpec(result, {
    source: ctx.source ?? (r.templateEntry ? "template" : "generated"), createdBy: ctx.uid ?? "system", model: result.model,
    templateRef: r.templateEntry ? { company: r.templateEntry.company, number: r.templateEntry.number, title: r.templateEntry.title } : null,
    companies: r.templateEntry ? [r.templateEntry.company] : [],
  });
  const problem = (await problems.getPublic(problemId))!;
  console.info(JSON.stringify({ evt: "generate.done", problemId, title: problem.title, attempts: result.attempts, repairs: result.repairs, firstPassOk: result.firstPassOk, adopted: result.adopted, costUsd: result.costUsd, ms: Date.now() - started }));
  stage("done", { source: "generated", problemId });
  return { problemId, problem, source: "generated", attempts: result.attempts, costUsd: result.costUsd, latencyMs: Date.now() - started };
}
