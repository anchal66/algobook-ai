import { describe, expect, it } from "vitest";
import { instrument } from "@/lib/trace/js/instrument";
import { runInstrumented } from "@/lib/trace/js/runtime";
import { Replayer, chapters, divergeAt, findStep, formatValue, replay } from "@/lib/trace/replay";
import type { Trace } from "@/lib/trace/types";

const DRIVER = `const r = f(3); console.log(r);`;

function trace(user: string): Trace {
  return runInstrumented(instrument(user).code, DRIVER, { stdin: "" });
}

describe("replay", () => {
  const t = trace(`function f(n) {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += g(i);
  }
  return total;
}
function g(x) { return x * 2; }`);

  it("random access equals sequential replay", () => {
    const r = new Replayer(t);
    const seq = t.steps.map((_, i) => JSON.stringify(replay(t, i)));
    // jump around
    for (const i of [5, 2, t.steps.length - 1, 0, 7, 3]) expect(JSON.stringify(r.at(i))).toBe(seq[i]);
    expect(r.at(t.steps.length - 1).stdout).toBe("6\n");
  });

  it("derives call and loop chapters", () => {
    const ch = chapters(t);
    const calls = ch.filter((c) => c.kind === "call").map((c) => c.label);
    expect(calls.filter((l) => l === "g()").length).toBe(3);
    expect(calls).toContain("f()");
    const loops = ch.filter((c) => c.kind === "loop");
    expect(loops.length).toBeGreaterThanOrEqual(2);
    expect(loops[0].label).toBe("iteration 1");
    for (const c of ch) expect(c.from).toBeLessThanOrEqual(c.to);
  });

  it("findStep walks forwards and backwards", () => {
    const firstReturn = findStep(t, -1, 1, (s) => s.ev === "return");
    expect(firstReturn).not.toBeNull();
    expect(t.steps[firstReturn!].ret).toBe(0);
    expect(findStep(t, 0, -1, () => true)).toBeNull();
  });

  it("divergeAt handles trailing whitespace and no output", () => {
    expect(divergeAt({ ...t, expected: "6" })).toBeUndefined();
    expect(divergeAt({ ...t, expected: "6\n" })).toBeUndefined();
    expect(divergeAt({ ...t, expected: "7" })).toBe(t.steps.length - 1);
    expect(divergeAt({ ...t, steps: [], stdout: "", expected: "1" })).toBeUndefined();
  });

  it("formats values inline", () => {
    const heap = { "@1": { t: "list" as const, items: [1, 2, 3], n: 3 }, "@2": { t: "node" as const, cls: "ListNode", fields: { val: 1, next: null } } };
    expect(formatValue({ ref: "@1" }, heap)).toBe("[1, 2, 3]");
    expect(formatValue({ ref: "@2" }, heap)).toBe("ListNode(val=1, next=None)");
    expect(formatValue({ sp: "undefined" })).toBe("undefined");
    expect(formatValue("a\"b")).toBe("\"a\\\"b\"");
    expect(formatValue(1.5)).toBe("1.5");
  });
});
