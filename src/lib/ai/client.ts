import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseCreateParamsNonStreaming, ResponseInput, ResponseStreamEvent } from "openai/resources/responses/responses";
import type { ZodType } from "zod";
import { env } from "@/lib/env";
import * as aiUsage from "@/lib/data/aiUsage";
import { MODEL_POLICY, estimateCost, modelFor, reasoningFor, type AiPurpose, type ModelId, type ReasoningEffort, type TokenUsage, type Verbosity } from "@/lib/ai/models";

/**
 * Single typed entry point for every OpenAI call (Module 02 §3.1).
 *  - Responses API only, `store: false`, static `instructions` first, dynamic `input` last.
 *  - Structured outputs via `zodTextFormat` (strict JSON schema) + our own zod parse.
 *  - Retries: 429/5xx/network ×3 with exponential backoff; schema failure → one retry with the error appended.
 *  - Cost from MODEL_PRICES; every call logs an `aiUsage` doc (fire-and-forget) and one JSON log line.
 */

export type AiErrorKind = "refusal" | "schema" | "incomplete" | "upstream";
export class AiError extends Error {
  constructor(message: string, public readonly kind: AiErrorKind, public readonly detail?: unknown) {
    super(message);
    this.name = "AiError";
  }
}

let cached: OpenAI | null = null;
let factory: () => OpenAI = () => new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 240_000 });

export function getOpenAI(): OpenAI {
  if (!cached) cached = factory();
  return cached;
}
/** Test hook: inject a fake client (pass null to reset). */
export function __setOpenAIForTests(client: OpenAI | null, makeDefault?: () => OpenAI): void {
  cached = client;
  if (makeDefault) factory = makeDefault;
}

export interface AiCallOptions<T> {
  purpose: AiPurpose;
  model?: ModelId;
  /** Static, byte-stable per purpose (prompt cache). */
  instructions: string;
  input: string | ResponseInput;
  schema?: ZodType<T>;
  schemaName?: string;
  reasoning?: ReasoningEffort;
  verbosity?: Verbosity;
  maxOutputTokens?: number;
  uid?: string;
  problemId?: string;
  /** Groups requests for prompt caching (defaults to the purpose). */
  promptCacheKey?: string;
}

export interface AiResult<T> {
  data: T;
  text: string;
  usage: TokenUsage;
  costUsd: number;
  model: string;
  latencyMs: number;
  /** Model round-trips actually made (1 normally, 2 after a schema retry). */
  attempts: number;
}

const RETRY_DELAYS_MS = [800, 1600, 3200];

function isRetryable(e: unknown): boolean {
  const err = e as { status?: number; code?: string; name?: string };
  if (err?.status === 429 || (typeof err?.status === "number" && err.status >= 500)) return true;
  return err?.name === "APIConnectionError" || err?.name === "APIConnectionTimeoutError" || err?.code === "ECONNRESET";
}

async function withRetry<R>(label: string, fn: () => Promise<R>): Promise<R> {
  let last: unknown;
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isRetryable(e) || i === RETRY_DELAYS_MS.length) break;
      const wait = RETRY_DELAYS_MS[i] + Math.floor(Math.random() * 300);
      console.warn(JSON.stringify({ evt: "ai.retry", label, attempt: i + 1, wait, status: (e as { status?: number })?.status, message: (e as Error)?.message?.slice(0, 200) }));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  const err = last as { status?: number; message?: string };
  throw new AiError(`OpenAI request failed${err?.status ? ` (${err.status})` : ""}: ${err?.message ?? "unknown error"}`, "upstream", last);
}

export function toTokenUsage(u: OpenAI.Responses.ResponseUsage | null | undefined): TokenUsage {
  return {
    inputTokens: u?.input_tokens ?? 0,
    cachedTokens: u?.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    reasoningTokens: u?.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

export interface LogFields { purpose: AiPurpose | string; model: string; usage: TokenUsage; costUsd: number; latencyMs: number; uid?: string; problemId?: string; ok: boolean; error?: string }

/** Writes the telemetry doc + log line. Never throws, never awaited by callers. */
export function logUsage(f: LogFields): void {
  console.info(JSON.stringify({ evt: "ai.call", purpose: f.purpose, model: f.model, ...f.usage, costUsd: f.costUsd, latencyMs: f.latencyMs, ok: f.ok, error: f.error, uid: f.uid, problemId: f.problemId }));
  void aiUsage.log({
    purpose: f.purpose, model: f.model,
    inputTokens: f.usage.inputTokens, cachedTokens: f.usage.cachedTokens, outputTokens: f.usage.outputTokens, reasoningTokens: f.usage.reasoningTokens,
    costUsd: f.costUsd, latencyMs: f.latencyMs, uid: f.uid ?? null, problemId: f.problemId ?? null, ok: f.ok, error: f.error ?? null,
  });
}

function toInput(input: string | ResponseInput): ResponseInput {
  return typeof input === "string" ? [{ role: "user", content: input }] : input;
}

function baseParams<T>(o: AiCallOptions<T>, model: ModelId): ResponseCreateParamsNonStreaming {
  const policy = MODEL_POLICY[o.purpose];
  const effort = o.reasoning ?? reasoningFor(o.purpose);
  const verbosity = o.verbosity ?? policy.verbosity;
  const params: ResponseCreateParamsNonStreaming = {
    model,
    instructions: o.instructions,
    input: toInput(o.input),
    store: false,
    max_output_tokens: o.maxOutputTokens ?? policy.maxOutputTokens,
    prompt_cache_key: o.promptCacheKey ?? `algobook:${o.purpose}`,
  };
  if (effort) params.reasoning = { effort };
  const text: NonNullable<ResponseCreateParamsNonStreaming["text"]> = {};
  if (verbosity) text.verbosity = verbosity;
  if (o.schema) text.format = zodTextFormat(o.schema, o.schemaName ?? `${o.purpose}_output`);
  if (Object.keys(text).length) params.text = text;
  return params;
}

function refusalOf(res: OpenAI.Responses.Response): string | null {
  for (const item of res.output) {
    if (item.type !== "message") continue;
    for (const c of item.content) if (c.type === "refusal") return c.refusal;
  }
  return null;
}

/** One model call with structured (schema) or plain-text output. */
export async function aiCall<T = string>(o: AiCallOptions<T>): Promise<AiResult<T>> {
  const client = getOpenAI();
  const model = o.model ?? modelFor(o.purpose);
  const params = baseParams(o, model);
  const started = Date.now();
  const total: TokenUsage = { inputTokens: 0, cachedTokens: 0, outputTokens: 0, reasoningTokens: 0 };
  let attempts = 0;
  let lastText = "";

  const finish = (ok: boolean, error?: string) => {
    const costUsd = estimateCost(model, total);
    logUsage({ purpose: o.purpose, model, usage: total, costUsd, latencyMs: Date.now() - started, uid: o.uid, problemId: o.problemId, ok, error });
    return costUsd;
  };

  let input = params.input as ResponseInput;
  for (let round = 0; round < 2; round++) {
    attempts++;
    let res: OpenAI.Responses.Response;
    try {
      res = await withRetry(o.purpose, () => client.responses.create({ ...params, input }));
    } catch (e) {
      finish(false, (e as Error).message?.slice(0, 300));
      throw e;
    }
    const u = toTokenUsage(res.usage);
    total.inputTokens += u.inputTokens; total.cachedTokens += u.cachedTokens; total.outputTokens += u.outputTokens; total.reasoningTokens += u.reasoningTokens;
    const text = res.output_text ?? "";
    lastText = text;

    const refusal = refusalOf(res);
    if (refusal) { finish(false, `refusal: ${refusal.slice(0, 200)}`); throw new AiError(`Model refused: ${refusal}`, "refusal"); }
    if (res.status === "incomplete" && res.incomplete_details?.reason === "max_output_tokens") {
      finish(false, "incomplete: max_output_tokens");
      throw new AiError("Model output was cut off (max_output_tokens); raise maxOutputTokens or reduce verbosity", "incomplete", { text: text.slice(0, 500) });
    }
    if (!o.schema) {
      const costUsd = finish(true);
      return { data: text as unknown as T, text, usage: total, costUsd, model, latencyMs: Date.now() - started, attempts };
    }

    let parsedJson: unknown;
    let problem = "";
    try { parsedJson = JSON.parse(text); } catch { problem = "output was not valid JSON"; }
    if (!problem) {
      const r = o.schema.safeParse(parsedJson);
      if (r.success) {
        const costUsd = finish(true);
        return { data: r.data, text, usage: total, costUsd, model, latencyMs: Date.now() - started, attempts };
      }
      problem = r.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    }
    if (round === 1) break;
    console.warn(JSON.stringify({ evt: "ai.schema_retry", purpose: o.purpose, problem: problem.slice(0, 300) }));
    input = [
      ...toInput(o.input),
      { role: "assistant", content: text.slice(0, 12_000) },
      { role: "user", content: `Your previous JSON failed validation: ${problem}. Reply with ONE corrected JSON object that satisfies the schema. No prose.` },
    ];
  }
  finish(false, "schema validation failed twice");
  throw new AiError("Model output did not match the expected schema", "schema", { text: lastText.slice(0, 500) });
}

/**
 * Streams plain text; `onDelta` receives chunks as they arrive. Resolves with the full text and usage.
 * Retries only before the first byte is sent.
 */
export async function aiStream(o: Omit<AiCallOptions<string>, "schema" | "schemaName">, onDelta: (delta: string) => void): Promise<AiResult<string>> {
  const client = getOpenAI();
  const model = o.model ?? modelFor(o.purpose);
  const params = baseParams(o, model);
  const started = Date.now();
  let text = "";
  let usage: TokenUsage = { inputTokens: 0, cachedTokens: 0, outputTokens: 0, reasoningTokens: 0 };
  try {
    const stream = await withRetry(o.purpose, () => client.responses.create({ ...params, stream: true }));
    for await (const ev of stream as AsyncIterable<ResponseStreamEvent>) {
      if (ev.type === "response.output_text.delta") { text += ev.delta; onDelta(ev.delta); }
      else if (ev.type === "response.completed") usage = toTokenUsage(ev.response.usage);
      else if (ev.type === "response.incomplete") usage = toTokenUsage(ev.response.usage);
      else if (ev.type === "response.failed") throw new AiError(ev.response.error?.message ?? "Response failed", "upstream");
      else if (ev.type === "error") throw new AiError(ev.message ?? "Stream error", "upstream");
    }
  } catch (e) {
    logUsage({ purpose: o.purpose, model, usage, costUsd: estimateCost(model, usage), latencyMs: Date.now() - started, uid: o.uid, problemId: o.problemId, ok: false, error: (e as Error).message?.slice(0, 300) });
    throw e;
  }
  const costUsd = estimateCost(model, usage);
  logUsage({ purpose: o.purpose, model, usage, costUsd, latencyMs: Date.now() - started, uid: o.uid, problemId: o.problemId, ok: true });
  return { data: text, text, usage, costUsd, model, latencyMs: Date.now() - started, attempts: 1 };
}

export const EMBEDDING_DIMENSIONS = 1536;

/** text-embedding-3-small, 1536 dims. Input is capped at ~8k chars. */
export async function embed(text: string, meta: { uid?: string; problemId?: string } = {}): Promise<{ embedding: number[]; costUsd: number; model: string }> {
  const client = getOpenAI();
  const model = modelFor("embed");
  const started = Date.now();
  const input = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  try {
    const res = await withRetry("embed", () => client.embeddings.create({ model, input, dimensions: EMBEDDING_DIMENSIONS, encoding_format: "float" }));
    const usage: TokenUsage = { inputTokens: res.usage?.prompt_tokens ?? 0, cachedTokens: 0, outputTokens: 0, reasoningTokens: 0 };
    const costUsd = estimateCost(model, usage);
    logUsage({ purpose: "embed", model, usage, costUsd, latencyMs: Date.now() - started, ...meta, ok: true });
    return { embedding: res.data[0].embedding, costUsd, model };
  } catch (e) {
    logUsage({ purpose: "embed", model, usage: { inputTokens: 0, cachedTokens: 0, outputTokens: 0, reasoningTokens: 0 }, costUsd: 0, latencyMs: Date.now() - started, ...meta, ok: false, error: (e as Error).message?.slice(0, 300) });
    throw e;
  }
}
