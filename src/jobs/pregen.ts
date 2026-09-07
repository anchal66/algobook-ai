import "server-only";
import { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { Difficulty, ExperienceLevel, PregenJob, WithId } from "@/lib/data/schema";
import * as problems from "@/lib/data/problems";
import * as jobs from "@/lib/data/jobs";
import * as templates from "@/lib/data/templates";
import { env } from "@/lib/env";
import { getOpenAI, logUsage, toTokenUsage } from "@/lib/ai/client";
import { BATCH_DISCOUNT, MODEL_POLICY, estimateCost, modelFor } from "@/lib/ai/models";
import { ProblemSpecSchema } from "@/lib/ai/schemas";
import { GEN_INSTRUCTIONS, buildGenInput } from "@/lib/ai/prompts";
import { persistSpec, verifyAndRepair } from "@/lib/ai/generate";
import { fanOutLanguages } from "@/lib/ai/drivers";
import { CORE_TOPICS } from "@/lib/practice/topics";

/**
 * Pre-generation via the OpenAI Batch API (Module 02 §3.6).
 *  submit:  compute topic×difficulty deficits (+ company template entries) → one JSONL of /v1/responses
 *           requests → files.create + batches.create → `jobs/pregen_<batchId>`.
 *  collect: for each open job whose batch completed, download the output, and for each line:
 *           parse → static validation → Judge verification → repairs (live) → persist verified → fan out
 *           Python/C++/JS. Works in bounded chunks (`cursor`) so one cron call stays under maxDuration
 *           and under the Judge0 daily quota.
 */

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];
const EXPERIENCE_FOR: Record<Difficulty, ExperienceLevel> = { Easy: "beginner", Medium: "intermediate", Hard: "advanced" };
const COLLECT_CHUNK = Number(process.env.PREGEN_COLLECT_CHUNK ?? 8);

export interface Deficit { topic: string; difficulty: Difficulty; have: number; need: number }

export async function computeDeficits(poolMin = env.PREGEN_POOL_MIN): Promise<Deficit[]> {
  const out: Deficit[] = [];
  for (const topic of CORE_TOPICS) {
    for (const difficulty of DIFFICULTIES) {
      const have = await problems.countVerified(topic, difficulty);
      if (have < poolMin) out.push({ topic, difficulty, have, need: poolMin - have });
    }
  }
  return out;
}

type RequestMeta = PregenJob["requests"][string];

export interface BuildOptions {
  maxRequests?: number;
  poolMin?: number;
  /** Company template ids to pre-generate for (default: none). */
  companies?: string[];
  /** Max template entries per company per run. */
  templateLimit?: number;
}

function requestLine(customId: string, input: string) {
  const model = modelFor("generate");
  const policy = MODEL_POLICY.generate;
  return JSON.stringify({
    custom_id: customId,
    method: "POST",
    url: "/v1/responses",
    body: {
      model, instructions: GEN_INSTRUCTIONS, input: [{ role: "user", content: input }], store: false,
      max_output_tokens: policy.maxOutputTokens, reasoning: { effort: policy.reasoning }, text: { verbosity: policy.verbosity, format: zodTextFormat(ProblemSpecSchema, "problem_spec") },
      prompt_cache_key: "algobook:generate",
    },
  });
}

async function recentTitles(topic: string, difficulty: Difficulty): Promise<string[]> {
  const res = await problems.search({ tags: [topic], difficulty, status: "verified", limit: 12 });
  return res.items.map((i) => i.title);
}

/** Builds the JSONL lines and their metadata for one batch run. */
export async function buildRequests(o: BuildOptions = {}): Promise<{ lines: string[]; requests: Record<string, RequestMeta> }> {
  const max = o.maxRequests ?? env.PREGEN_MAX_PER_RUN;
  const lines: string[] = [];
  const requests: Record<string, RequestMeta> = {};
  let n = 0;

  const deficits = await computeDeficits(o.poolMin);
  // Round-robin over cells so every cell gets something before any cell gets everything.
  const queue = deficits.map((d) => ({ ...d, left: d.need }));
  while (n < max && queue.some((q) => q.left > 0)) {
    for (const q of queue) {
      if (n >= max) break;
      if (q.left <= 0) continue;
      q.left--;
      const id = `pool_${q.topic.replace(/\s+/g, "-")}_${q.difficulty}_${n}`;
      const titles = await recentTitles(q.topic, q.difficulty);
      lines.push(requestLine(id, buildGenInput({
        difficulty: q.difficulty, topics: [q.topic], avoidTopics: [], experienceLevel: EXPERIENCE_FOR[q.difficulty], goalType: "interview-prep",
        profileSummary: "", recentTitles: titles, templateEntry: null, isCalibration: false, projectDescription: "", userPrompt: undefined,
      })));
      requests[id] = { kind: "pool", difficulty: q.difficulty, topics: [q.topic], company: null, templateRef: null };
      n++;
    }
  }

  for (const company of o.companies ?? []) {
    if (n >= max) break;
    const items = await templates.getTemplateItems(company);
    let added = 0;
    for (const it of items.slice(0, 200)) {
      if (n >= max || added >= (o.templateLimit ?? 30)) break;
      const existing = await problems.findByTemplateTitle(it.title, { limit: 1 });
      if (existing.length) continue;
      const id = `tpl_${company}_${it.number}_${n}`;
      lines.push(requestLine(id, buildGenInput({
        difficulty: it.difficulty, topics: [], avoidTopics: [], experienceLevel: EXPERIENCE_FOR[it.difficulty], goalType: "interview-prep",
        profileSummary: "", recentTitles: [], templateEntry: { title: it.title, number: it.number, difficulty: it.difficulty, company }, isCalibration: false, projectDescription: "", userPrompt: undefined,
      })));
      requests[id] = { kind: "template", difficulty: it.difficulty, topics: [], company, templateRef: { company, number: it.number, title: it.title } };
      n++; added++;
    }
  }
  return { lines, requests };
}

/** Uploads the JSONL and creates the batch. Returns null when there is nothing to generate. */
export async function submitPregenBatch(o: BuildOptions = {}): Promise<WithId<PregenJob> | null> {
  const { lines, requests } = await buildRequests(o);
  if (!lines.length) return null;
  const client = getOpenAI();
  const file = await client.files.create({ file: await toFile(Buffer.from(lines.join("\n") + "\n", "utf8"), `pregen-${Date.now()}.jsonl`), purpose: "batch" });
  const batch = await client.batches.create({ input_file_id: file.id, endpoint: "/v1/responses", completion_window: "24h", metadata: { app: "algobook", kind: "pregen" } });
  const job = await jobs.createPregenJob(`pregen_${batch.id}`, { status: "submitted", batchId: batch.id, inputFileId: file.id, outputFileId: null, requested: lines.length, cursor: 0, requests, results: { processed: 0, verified: 0, repaired: 0, failed: 0, costUsd: 0 }, error: null });
  console.info(JSON.stringify({ evt: "pregen.submitted", batchId: batch.id, requested: lines.length }));
  return job;
}

interface OutputLine { custom_id: string; response?: { status_code: number; body: Record<string, unknown> }; error?: { message?: string } | null }

function specFromResponseBody(body: Record<string, unknown>): { text: string | null; usage: ReturnType<typeof toTokenUsage>; model: string } {
  const model = (body.model as string) ?? modelFor("generate");
  const usage = toTokenUsage(body.usage as never);
  let text: string | null = null;
  for (const item of (body.output as Array<Record<string, unknown>>) ?? []) {
    if (item.type !== "message") continue;
    for (const c of (item.content as Array<Record<string, unknown>>) ?? []) if (c.type === "output_text") text = c.text as string;
  }
  return { text, usage, model };
}

/** Processes up to COLLECT_CHUNK output lines of one job. Returns the job's new status. */
export async function collectPregenJob(job: WithId<PregenJob>, chunk = COLLECT_CHUNK): Promise<{ status: PregenJob["status"]; processed: number; batchStatus: string }> {
  const client = getOpenAI();
  const batch = await client.batches.retrieve(job.batchId);
  if (["validating", "in_progress", "finalizing"].includes(batch.status)) return { status: job.status, processed: 0, batchStatus: batch.status };
  if (["failed", "expired", "cancelled", "cancelling"].includes(batch.status)) {
    await jobs.updatePregenJob(job.id, { status: batch.status === "failed" ? "failed" : "cancelled", error: JSON.stringify(batch.errors ?? batch.status).slice(0, 500) });
    return { status: "failed", processed: 0, batchStatus: batch.status };
  }
  const outputFileId = batch.output_file_id ?? job.outputFileId;
  if (!outputFileId) { await jobs.updatePregenJob(job.id, { status: "failed", error: "batch completed without an output file" }); return { status: "failed", processed: 0, batchStatus: batch.status }; }
  if (job.status !== "collecting" || job.outputFileId !== outputFileId) await jobs.updatePregenJob(job.id, { status: "collecting", outputFileId });

  const content = await (await client.files.content(outputFileId)).text();
  const lines = content.split("\n").filter((l) => l.trim());
  const results = { ...job.results };
  let cursor = job.cursor;
  let processed = 0;
  while (cursor < lines.length && processed < chunk) {
    const line = lines[cursor++];
    processed++;
    let parsed: OutputLine;
    try { parsed = JSON.parse(line); } catch { results.failed++; continue; }
    const meta = job.requests[parsed.custom_id];
    results.processed++;
    if (!meta || !parsed.response || parsed.response.status_code !== 200) { results.failed++; console.warn(JSON.stringify({ evt: "pregen.line_failed", customId: parsed.custom_id, error: parsed.error?.message ?? parsed.response?.status_code })); continue; }
    const { text, usage, model } = specFromResponseBody(parsed.response.body);
    const costUsd = estimateCost(model, usage, BATCH_DISCOUNT);
    results.costUsd += costUsd;
    logUsage({ purpose: "generate", model, usage, costUsd, latencyMs: 0, ok: !!text });
    let spec;
    try { spec = ProblemSpecSchema.parse(JSON.parse(text ?? "")); } catch (e) { results.failed++; console.warn(JSON.stringify({ evt: "pregen.parse_failed", customId: parsed.custom_id, message: (e as Error).message?.slice(0, 200) })); continue; }
    try {
      const vr = await verifyAndRepair(spec, { fallbackTopics: meta.topics, model });
      results.costUsd += vr.costUsd;
      if (!vr.ok) { results.failed++; console.warn(JSON.stringify({ evt: "pregen.unverified", customId: parsed.custom_id, errors: vr.errors })); continue; }
      if (vr.repairs) results.repaired++;
      const problemId = await persistSpec({ spec: vr.spec, judge: vr.judge!, embedding: null, attempts: 1 + vr.attempts, repairs: vr.repairs, firstPassOk: vr.firstPassOk, costUsd, model: vr.model, latencyMs: 0 }, {
        source: meta.kind === "template" ? "template" : "generated", createdBy: "pregen", model: vr.model, templateRef: meta.templateRef, companies: meta.company ? [meta.company] : [],
      });
      results.verified++;
      const fan = await fanOutLanguages(problemId);
      results.costUsd += Object.values(fan).reduce((a, r) => a + (r.costUsd ?? 0), 0);
      console.info(JSON.stringify({ evt: "pregen.verified", customId: parsed.custom_id, problemId, title: vr.spec.title, languages: Object.entries(fan).filter(([, r]) => r.status === "ready").map(([l]) => l) }));
    } catch (e) {
      results.failed++;
      console.error(JSON.stringify({ evt: "pregen.item_error", customId: parsed.custom_id, message: (e as Error).message?.slice(0, 300) }));
    }
  }
  const done = cursor >= lines.length;
  await jobs.updatePregenJob(job.id, { status: done ? "done" : "collecting", results, cursor });
  return { status: done ? "done" : "collecting", processed, batchStatus: batch.status };
}

/** One cron tick: collect open jobs (bounded), then submit a new batch when nothing is open. */
export async function pregenTick(o: BuildOptions & { submit?: boolean } = {}): Promise<Record<string, unknown>> {
  const open = await jobs.listOpenPregenJobs();
  const collected: Record<string, unknown>[] = [];
  for (const job of open) {
    const r = await collectPregenJob(job);
    collected.push({ id: job.id, ...r });
    if (r.processed >= COLLECT_CHUNK) break; // one chunk per tick keeps Judge0 usage bounded
  }
  let submitted: string | null = null;
  const stillOpen = open.length && collected.some((c) => c.status !== "done" && c.status !== "failed");
  if ((o.submit ?? true) && !stillOpen) {
    const job = await submitPregenBatch(o);
    submitted = job?.id ?? null;
  }
  return { collected, submitted };
}
