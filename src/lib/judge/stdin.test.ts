import { describe, expect, it } from "vitest";
import { encodeInput, parseInput } from "./stdin";

const params = [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }];

describe("stdin encoding", () => {
  it("encodes Two Sum input per the canonical format", () => {
    expect(encodeInput(params, [[2, 7, 11, 15], 9])).toBe("4\n2 7 11 15\n9\n");
  });
  it("round-trips scalars, string arrays, matrices and trees", () => {
    const p = [
      { name: "s", type: "string" }, { name: "ok", type: "bool" }, { name: "words", type: "string[]" },
      { name: "grid", type: "int[][]" }, { name: "root", type: "TreeNode" }, { name: "c", type: "char" },
    ];
    const v = ["hello world", true, ["a", "bb"], [[1, 2], [3, 4]], [1, 2, null, 3], "x"];
    const stdin = encodeInput(p, v);
    expect(stdin).toBe("hello world\ntrue\n2\na\nbb\n2 2\n1 2\n3 4\n[1,2,null,3]\nx\n");
    expect(parseInput(p, stdin)).toEqual(v);
  });
  it("handles empty arrays", () => {
    expect(encodeInput(params, [[], 0])).toBe("0\n\n0\n");
    expect(parseInput(params, "0\n\n0\n")).toEqual([[], 0]);
  });
});
