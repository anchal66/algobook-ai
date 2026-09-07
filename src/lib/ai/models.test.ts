import { afterEach, describe, expect, it } from "vitest";
import { MODEL_POLICY, MODEL_PRICES, estimateCost, modelFor } from "./models";

describe("models", () => {
  afterEach(() => { delete process.env.AI_MODEL_OVERRIDE_GENERATE; });

  it("prices a typical Luna generation call under 1 cent", () => {
    const usd = estimateCost("gpt-5.6-luna", { inputTokens: 1600, cachedTokens: 1100, outputTokens: 6000, reasoningTokens: 2500 });
    expect(usd).toBeCloseTo((500 * 0.2 + 1100 * 0.02 + 6000 * 1.2) / 1e6, 6);
    expect(usd).toBeLessThan(0.01);
  });

  it("applies the batch discount", () => {
    const full = estimateCost("gpt-5.6-luna", { inputTokens: 1000, cachedTokens: 0, outputTokens: 1000, reasoningTokens: 0 });
    expect(estimateCost("gpt-5.6-luna", { inputTokens: 1000, cachedTokens: 0, outputTokens: 1000, reasoningTokens: 0 }, 0.5)).toBeCloseTo(full / 2, 9);
  });

  it("uses the policy model unless a known override is set", () => {
    expect(modelFor("generate")).toBe(MODEL_POLICY.generate.model);
    process.env.AI_MODEL_OVERRIDE_GENERATE = "gpt-5.6-terra";
    expect(modelFor("generate")).toBe("gpt-5.6-terra");
    process.env.AI_MODEL_OVERRIDE_GENERATE = "not-a-model";
    expect(modelFor("generate")).toBe(MODEL_POLICY.generate.model);
  });

  it("every policy model has a price", () => {
    for (const p of Object.values(MODEL_POLICY)) expect(MODEL_PRICES[p.model]).toBeDefined();
  });
});
