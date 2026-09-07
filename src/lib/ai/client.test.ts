import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type OpenAI from "openai";

vi.mock("@/lib/env", () => ({ env: { OPENAI_API_KEY: "sk-test" } }));
vi.mock("@/lib/data/aiUsage", () => ({ log: vi.fn(async () => undefined) }));

import { aiCall, __setOpenAIForTests } from "./client";
import * as aiUsage from "@/lib/data/aiUsage";

type Create = (params: Record<string, unknown>) => Promise<unknown>;
function fakeClient(create: Create): OpenAI {
  return { responses: { create } } as unknown as OpenAI;
}
const response = (text: string, extra: Record<string, unknown> = {}) => ({
  status: "completed", output_text: text, output: [{ type: "message", content: [{ type: "output_text", text }] }],
  usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 40 }, output_tokens: 50, output_tokens_details: { reasoning_tokens: 10 } },
  ...extra,
});

describe("aiCall", () => {
  beforeEach(() => { vi.spyOn(console, "info").mockImplementation(() => undefined); vi.spyOn(console, "warn").mockImplementation(() => undefined); });
  afterEach(() => { __setOpenAIForTests(null); vi.restoreAllMocks(); });

  it("sends static instructions, store:false, reasoning + verbosity, and parses structured output", async () => {
    const calls: Record<string, unknown>[] = [];
    __setOpenAIForTests(fakeClient(async (p) => { calls.push(p); return response('{"a":1}'); }));
    const res = await aiCall({ purpose: "hint3", instructions: "STATIC", input: "dynamic", schema: z.object({ a: z.number() }) });
    expect(res.data).toEqual({ a: 1 });
    expect(res.costUsd).toBeCloseTo((60 * 0.2 + 40 * 0.02 + 50 * 1.2) / 1e6, 6);
    expect(calls[0]).toMatchObject({ model: "gpt-5.6-luna", instructions: "STATIC", store: false, max_output_tokens: 1200, reasoning: { effort: "low" }, text: { verbosity: "low" } });
    expect((calls[0].text as { format: { type: string; strict: boolean } }).format).toMatchObject({ type: "json_schema", strict: true });
    expect(calls[0].input).toEqual([{ role: "user", content: "dynamic" }]);
    expect(aiUsage.log).toHaveBeenCalledWith(expect.objectContaining({ purpose: "hint3", ok: true, cachedTokens: 40, reasoningTokens: 10 }));
  });

  it("retries once with the validation error when the output does not match the schema", async () => {
    let n = 0;
    __setOpenAIForTests(fakeClient(async (p) => {
      n++;
      if (n === 1) return response('{"a":"nope"}');
      const input = p.input as { role: string; content: string }[];
      expect(input.at(-1)!.content).toMatch(/failed validation: a: /);
      return response('{"a":2}');
    }));
    const res = await aiCall({ purpose: "review", instructions: "S", input: "d", schema: z.object({ a: z.number() }) });
    expect(res.data).toEqual({ a: 2 });
    expect(res.attempts).toBe(2);
  });

  it("retries transient 5xx/429 errors and then succeeds", async () => {
    vi.useFakeTimers();
    let n = 0;
    __setOpenAIForTests(fakeClient(async () => { n++; if (n < 3) throw Object.assign(new Error("rate limited"), { status: 429 }); return response("ok"); }));
    const p = aiCall({ purpose: "explain", instructions: "S", input: "d" });
    await vi.runAllTimersAsync();
    expect((await p).text).toBe("ok");
    expect(n).toBe(3);
    vi.useRealTimers();
  });

  it("surfaces refusals and truncation as AiError", async () => {
    __setOpenAIForTests(fakeClient(async () => ({ ...response(""), output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] })));
    await expect(aiCall({ purpose: "chat", instructions: "S", input: "d" })).rejects.toMatchObject({ kind: "refusal" });
    __setOpenAIForTests(fakeClient(async () => response("partial", { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } })));
    await expect(aiCall({ purpose: "chat", instructions: "S", input: "d" })).rejects.toMatchObject({ kind: "incomplete" });
  });
});
