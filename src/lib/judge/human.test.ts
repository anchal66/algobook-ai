import { describe, expect, it } from "vitest";
import { fromHuman, parseHuman, toHuman } from "@/lib/judge/human";
import { encodeInput } from "@/lib/judge/stdin";
import type { ProblemParam } from "@/lib/data/schema";

const twoSum: ProblemParam[] = [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }];

describe("human ↔ stdin (Module 03 W-10)", () => {
  it("round-trips Two Sum through toHuman/fromHuman", () => {
    const stdin = encodeInput(twoSum, [[2, 7, 11, 15], 9]);
    const human = toHuman(twoSum, stdin);
    expect(human).toEqual(["[2,7,11,15]", "9"]);
    const back = fromHuman(twoSum, human);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.stdin).toBe(stdin);
  });

  it("round-trips every supported type", () => {
    const params: ProblemParam[] = [
      { name: "s", type: "string" }, { name: "c", type: "char" }, { name: "b", type: "bool" }, { name: "d", type: "double" },
      { name: "words", type: "string[]" }, { name: "grid", type: "int[][]" }, { name: "head", type: "ListNode" }, { name: "root", type: "TreeNode" },
    ];
    const values = ["a b", "x", true, 0.5, ["ab", "c"], [[1, 2], [3, 4]], [1, 2, 3], [1, null, 2]];
    const stdin = encodeInput(params, values);
    const human = toHuman(params, stdin);
    expect(human).toEqual(['"a b"', "'x'", "true", "0.5", '["ab","c"]', "[[1,2],[3,4]]", "[1,2,3]", "[1,null,2]"]);
    const back = fromHuman(params, human);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.stdin).toBe(stdin);
  });

  it("accepts raw strings and quoted strings alike", () => {
    expect(parseHuman("string", "hello world")).toBe("hello world");
    expect(parseHuman("string", '"hello world"')).toBe("hello world");
    expect(parseHuman("char", "a")).toBe("a");
    expect(parseHuman("char", "'a'")).toBe("a");
  });

  it("reports per-parameter errors with human messages", () => {
    const r = fromHuman(twoSum, ["[1,2,x]", "nine"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatch(/list/i);
      expect(r.errors[1]).toMatch(/integer/i);
    }
    expect(parseHuman("int[]", "[1,2.5]")).toBeInstanceOf(Error);
    expect(parseHuman("int[][]", "[[1,2],[3]]")).toBeInstanceOf(Error);
    expect(parseHuman("bool", "yes")).toBeInstanceOf(Error);
    expect(parseHuman("ListNode", "[1,'a']")).toBeInstanceOf(Error);
  });

  it("handles empty arrays and matrices", () => {
    const r = fromHuman([{ name: "a", type: "int[]" }, { name: "m", type: "int[][]" }], ["[]", "[]"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.stdin).toBe("0\n\n0 0\n");
  });
});
