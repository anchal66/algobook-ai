import { describe, expect, it } from "vitest";
import { validateSpec } from "./generate";
import type { ProblemSpec } from "./schemas";

const good: ProblemSpec = {
  title: "  Pair Sum Indices ", slug: "", difficulty: "Easy", tags: ["Arrays", "hash-table", "made-up-topic"],
  statementMd: "You are given `nums`…", functionName: "pairSum", returnType: "int[]",
  params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }],
  examples: [{ input: "nums = [1,2], target = 3", output: "[0,1]", explanation: null }, { input: "nums = [3,3], target = 6", output: "[0,1]", explanation: null }],
  constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"], followUp: null,
  checker: { type: "exact", eps: null },
  sampleTests: [{ input: "2\n1 2\n3\n", expectedOutput: "[0,1]" }, { input: "2\n3 3\n6\n", expectedOutput: "[0,1]" }],
  hiddenTests: Array.from({ length: 8 }, (_, i) => ({ input: `2\n${i + 10} ${i + 11}\n${2 * i + 21}\n`, expectedOutput: "[0,1]" })),
  starter: { java: "class Solution {\n    public int[] pairSum(int[] nums, int target) {\n        \n    }\n}" },
  driver: { java: "public class Main { public static void main(String[] a) { new Solution().pairSum(null, 0); } }" },
  reference: { java: "class Solution { public int[] pairSum(int[] nums, int target) { return new int[0]; } }" },
  hints: [{ label: "", text: "one" }, { label: "Algorithm Choice", text: "two" }, { label: "Implementation Trap", text: "three" }],
  timeLimitSec: 2.4,
};

describe("validateSpec", () => {
  it("normalises tags, title, slug, hint labels and time limit on a valid spec", () => {
    const { spec, errors } = validateSpec(good);
    expect(errors).toEqual([]);
    expect(spec.title).toBe("Pair Sum Indices");
    expect(spec.slug).toBe("pair-sum-indices");
    expect(spec.tags).toEqual(["array", "hash map"]);
    expect(spec.hints[0].label).toBe("Pattern Recognition");
    expect(spec.timeLimitSec).toBe(2);
  });

  it("falls back to the recommendation topics when no tag is recognised", () => {
    const { spec, errors } = validateSpec({ ...good, tags: ["nonsense"] }, ["two pointers"]);
    expect(errors).toEqual([]);
    expect(spec.tags).toEqual(["two pointers"]);
  });

  it("reports encoding mismatches, duplicate tests and harness structure problems", () => {
    const bad: ProblemSpec = {
      ...good,
      sampleTests: [{ input: "3\n1 2\n3\n", expectedOutput: "[0,1]" }, { input: "2\n3 3\n6\n", expectedOutput: "[0,1]" }],
      hiddenTests: [...good.hiddenTests.slice(0, 7), { ...good.hiddenTests[0] }],
      driver: { java: "public class Solution {}" },
      reference: { java: "class Main {}" },
    };
    const { errors } = validateSpec(bad);
    expect(errors.some((e) => e.includes("sampleTests[0] input does not match"))).toBe(true);
    expect(errors.some((e) => e.includes("duplicates hiddenTests[0]"))).toBe(true);
    expect(errors.some((e) => e.includes("driver.java must declare `public class Main`"))).toBe(true);
    expect(errors.some((e) => e.includes("reference.java must declare `class Solution`"))).toBe(true);
    expect(errors.some((e) => e.includes("must not define Main"))).toBe(true);
  });

  it("adds the default eps for float checkers and strips it otherwise", () => {
    expect(validateSpec({ ...good, checker: { type: "float", eps: null } }).spec.checker).toEqual({ type: "float", eps: 1e-5 });
    expect(validateSpec({ ...good, checker: { type: "exact", eps: 0.1 } }).spec.checker).toEqual({ type: "exact", eps: null });
  });
});
