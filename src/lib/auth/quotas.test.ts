import { describe, expect, it } from "vitest";
import { applyConsume, checkQuota, effectiveQuotas, nextUtcMidnight } from "./quotas";

const NOW = new Date("2026-09-07T10:00:00.000Z");

describe("quotas", () => {
  it("resets counters when the UTC date changes", () => {
    const q = effectiveQuotas({ date: "2026-09-06", run: 29 }, NOW);
    expect(q.date).toBe("2026-09-07");
    expect(q.run).toBe(0);
  });

  it("keeps counters for today", () => {
    const q = effectiveQuotas({ date: "2026-09-07", run: 29 }, NOW);
    expect(q.run).toBe(29);
  });

  it("free plan: 4th generate of the day is exhausted with resetAt at next UTC midnight", () => {
    const quotas = { date: "2026-09-07", generate: 3 };
    const c = checkQuota("free", "generate", quotas, NOW);
    expect(c.ok).toBe(false);
    expect(c.reason).toBe("exhausted");
    expect(c.resetAt).toBe("2026-09-08T00:00:00.000Z");
    expect(nextUtcMidnight(NOW).toISOString()).toBe("2026-09-08T00:00:00.000Z");
  });

  it("free plan: feature not in plan", () => {
    const c = checkQuota("free", "editorial", { date: "2026-09-07" }, NOW);
    expect(c.ok).toBe(false);
    expect(c.reason).toBe("not_in_plan");
  });

  it("pro plan: unlimited editorial", () => {
    const c = checkQuota("pro", "editorial", { date: "2026-09-07", editorial: 99999 }, NOW);
    expect(c.ok).toBe(true);
    expect(c.remaining).toBe(Infinity);
  });

  it("consume increments and rolls the date", () => {
    const a = applyConsume({ date: "2026-09-06", run: 10 }, "run", NOW);
    expect(a).toMatchObject({ date: "2026-09-07", run: 1 });
    const b = applyConsume(a, "run", NOW);
    expect(b.run).toBe(2);
    expect(b.submit).toBe(0);
  });

  it("free plan allows 30 runs then blocks", () => {
    let q = effectiveQuotas(undefined, NOW);
    for (let i = 0; i < 30; i++) {
      expect(checkQuota("free", "run", q, NOW).ok).toBe(true);
      q = applyConsume(q, "run", NOW);
    }
    expect(checkQuota("free", "run", q, NOW).ok).toBe(false);
  });
});
