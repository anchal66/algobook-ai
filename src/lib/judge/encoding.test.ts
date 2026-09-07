import { describe, expect, it } from "vitest";
import { lintInput } from "./encoding";
import { encodeInput } from "./stdin";

const twoSum = [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }];

describe("lintInput", () => {
  it("accepts what encodeInput produces", () => {
    const params = [
      { name: "nums", type: "int[]" }, { name: "target", type: "int" }, { name: "words", type: "string[]" }, { name: "grid", type: "int[][]" },
      { name: "s", type: "string" }, { name: "c", type: "char" }, { name: "ok", type: "bool" }, { name: "x", type: "double" }, { name: "root", type: "TreeNode" },
    ];
    const input = encodeInput(params, [[2, 7, 11], 9, ["ab", "c d"], [[1, 2], [3, 4]], "hello world", "z", true, 1.5, [1, null, 2]]);
    expect(lintInput(params, input)).toEqual({ ok: true, errors: [] });
  });

  it("flags a wrong element count", () => {
    const r = lintInput(twoSum, "3\n1 2\n5\n");
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/declared N=3 but found 2/);
  });

  it("flags missing lines and extra lines", () => {
    expect(lintInput(twoSum, "2\n1 2\n").errors[0]).toMatch(/input ended early/);
    expect(lintInput(twoSum, "2\n1 2\n3\n4\n").errors[0]).toMatch(/unexpected extra line/);
  });

  it("flags non-integer tokens and bad bools", () => {
    expect(lintInput(twoSum, "2\n1 x\n3\n").errors[0]).toMatch(/expected an integer token/);
    expect(lintInput([{ name: "f", type: "bool" }], "yes\n").errors[0]).toMatch(/expected true\/false/);
  });

  it("accepts an empty array and a string with spaces", () => {
    expect(lintInput([{ name: "a", type: "int[]" }, { name: "s", type: "string" }], "0\n\nhello there\n").ok).toBe(true);
  });

  it("validates matrices", () => {
    expect(lintInput([{ name: "g", type: "int[][]" }], "2 2\n1 2\n3\n").errors[0]).toMatch(/row 1 has 1 tokens, expected C=2/);
    expect(lintInput([{ name: "g", type: "int[][]" }], "2 2\n1 2\n3 4\n").ok).toBe(true);
  });

  it("requires bracket lists for ListNode/TreeNode", () => {
    expect(lintInput([{ name: "head", type: "ListNode" }], "1 2 3\n").errors[0]).toMatch(/bracket list/);
    expect(lintInput([{ name: "head", type: "ListNode" }], "[1,2,3]\n").ok).toBe(true);
  });
});
