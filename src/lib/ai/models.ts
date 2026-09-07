/**
 * AI model policy and prices (Master Plan §7). The ONLY place model ids may appear.
 * `AI_MODEL_OVERRIDE_<PURPOSE>` (e.g. AI_MODEL_OVERRIDE_GENERATE=gpt-5.6-terra) overrides per purpose.
 */
export type AiPurpose =
  | "generate" | "repair" | "driver" | "hint3" | "editorial" | "review" | "explain" | "chat" | "complete" | "insights" | "embed";

export type ModelId = "gpt-5.6-luna" | "gpt-5.6-terra" | "gpt-5.6-sol" | "gpt-6-astra" | "text-embedding-3-small";
export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";
export type Verbosity = "low" | "medium" | "high";

/** USD per 1M tokens. `cached` applies to prompt-cache hits (input side). */
export const MODEL_PRICES: Record<ModelId, { input: number; cached: number; output: number }> = {
  "gpt-5.6-luna": { input: 0.2, cached: 0.02, output: 1.2 },
  "gpt-5.6-terra": { input: 2, cached: 0.2, output: 12 },
  "gpt-5.6-sol": { input: 4, cached: 0.4, output: 20 },
  "gpt-6-astra": { input: 10, cached: 1, output: 50 },
  "text-embedding-3-small": { input: 0.02, cached: 0.02, output: 0 },
};

export interface PurposePolicy {
  model: ModelId;
  reasoning?: ReasoningEffort;
  verbosity?: Verbosity;
  maxOutputTokens: number;
}

export const MODEL_POLICY: Record<AiPurpose, PurposePolicy> = {
  generate: { model: "gpt-5.6-luna", reasoning: "high", verbosity: "low", maxOutputTokens: 16000 }, // reasoning tokens count against this budget (measured: 4–8k on `high`)
  repair: { model: "gpt-5.6-luna", reasoning: "xhigh", verbosity: "low", maxOutputTokens: 20000 },
  driver: { model: "gpt-5.6-luna", reasoning: "medium", verbosity: "low", maxOutputTokens: 8000 },
  hint3: { model: "gpt-5.6-luna", reasoning: "low", verbosity: "low", maxOutputTokens: 1200 },
  explain: { model: "gpt-5.6-luna", reasoning: "low", verbosity: "low", maxOutputTokens: 1200 },
  review: { model: "gpt-5.6-luna", reasoning: "low", verbosity: "low", maxOutputTokens: 2500 },
  editorial: { model: "gpt-5.6-luna", reasoning: "medium", verbosity: "medium", maxOutputTokens: 10000 },
  chat: { model: "gpt-5.6-luna", reasoning: "low", verbosity: "low", maxOutputTokens: 1500 },
  complete: { model: "gpt-5.6-luna", reasoning: "none", verbosity: "low", maxOutputTokens: 96 },
  insights: { model: "gpt-5.6-luna", reasoning: "low", verbosity: "low", maxOutputTokens: 2500 },
  embed: { model: "text-embedding-3-small", maxOutputTokens: 0 },
};

/** D-03 default: repair #1 Luna (effort chosen per feedback, see `repairEffortFor`), repair #2 Terra medium. */
export const REPAIR_LADDER: ReadonlyArray<{ model: ModelId; reasoning: ReasoningEffort }> = [
  { model: "gpt-5.6-luna", reasoning: "high" },
  { model: "gpt-5.6-terra", reasoning: "medium" },
];
/** Bulk pre-generation never waits on a user: a Terra repair ($0.04) costs 8× a fresh batch generation, so Luna only. */
export const PREGEN_REPAIR_LADDER: ReadonlyArray<{ model: ModelId; reasoning: ReasoningEffort }> = [{ model: "gpt-5.6-luna", reasoning: "high" }];

/**
 * Repair effort by what went wrong (audit 2026-09-08): static contract errors (encoding, duplicate sample, class
 * names) are mechanical rewrites — `medium`; judge failures (WA/RE/CE/TLE) get `high`. `xhigh` measured 9k reasoning
 * tokens for a `[0,5,10]` → `3\n0 5 10` fix, which is where repair spend went.
 */
export function repairEffortFor(kind: "static" | "judge", rung: { model: ModelId; reasoning: ReasoningEffort }): ReasoningEffort {
  const override = process.env.AI_REASONING_OVERRIDE_REPAIR;
  if (override && EFFORTS.has(override)) return override as ReasoningEffort;
  if (rung.model !== "gpt-5.6-luna") return rung.reasoning;
  return kind === "static" ? "medium" : "high";
}

/**
 * Generation effort/budget by difficulty. Easy problems' failure modes are spec discipline, not reasoning depth
 * (measured `medium` ≈ same verification outcome at ½ cost, ⅓ latency). `AI_REASONING_OVERRIDE_GENERATE` still wins.
 */
export function generationPolicyFor(difficulty: "Easy" | "Medium" | "Hard"): { reasoning: ReasoningEffort; maxOutputTokens: number } {
  const base = reasoningFor("generate") ?? "high";
  const override = process.env.AI_REASONING_OVERRIDE_GENERATE;
  if (override && EFFORTS.has(override)) return { reasoning: override as ReasoningEffort, maxOutputTokens: MODEL_POLICY.generate.maxOutputTokens };
  if (difficulty === "Easy") return { reasoning: "medium", maxOutputTokens: 12000 };
  if (difficulty === "Medium") return { reasoning: base, maxOutputTokens: 14000 };
  return { reasoning: base, maxOutputTokens: MODEL_POLICY.generate.maxOutputTokens };
}

/** Batch API is 50% off list price (Master Plan §7). */
export const BATCH_DISCOUNT = 0.5;

const KNOWN = new Set<string>(Object.keys(MODEL_PRICES));

export function isModelId(x: string): x is ModelId {
  return KNOWN.has(x);
}

const EFFORTS = new Set<string>(["none", "low", "medium", "high", "xhigh", "max"]);
/** `AI_REASONING_OVERRIDE_<PURPOSE>` (experiments / the eval script). */
export function reasoningFor(purpose: AiPurpose): ReasoningEffort | undefined {
  const override = process.env[`AI_REASONING_OVERRIDE_${purpose.toUpperCase()}`];
  if (override && EFFORTS.has(override)) return override as ReasoningEffort;
  return MODEL_POLICY[purpose].reasoning;
}

/** Effective model for a purpose (env override wins when it names a known model). */
export function modelFor(purpose: AiPurpose): ModelId {
  const override = process.env[`AI_MODEL_OVERRIDE_${purpose.toUpperCase()}`];
  if (override && isModelId(override)) return override;
  return MODEL_POLICY[purpose].model;
}

export interface TokenUsage {
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

/** Cost in USD for one call. Output tokens already include reasoning tokens. */
export function estimateCost(model: string, u: TokenUsage, discount = 1): number {
  const p = MODEL_PRICES[model as ModelId] ?? MODEL_PRICES["gpt-5.6-luna"];
  const uncached = Math.max(0, u.inputTokens - u.cachedTokens);
  const usd = (uncached * p.input + u.cachedTokens * p.cached + u.outputTokens * p.output) / 1_000_000;
  return Math.round(usd * discount * 1e6) / 1e6;
}
