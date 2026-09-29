import { describe, expect, it } from "vitest";
import { detectShape, indexVariables, layoutGraph, layoutTree, listChains, pointerLabels, reachable, treeRoots } from "@/lib/trace/shapes";
import type { HeapObj, TraceState } from "@/lib/trace/types";

const heap: Record<string, HeapObj> = {
  "@1": { t: "list", items: [2, 7, 11], n: 3 },
  "@2": { t: "list", items: [{ ref: "@3" }, { ref: "@4" }], n: 2 },
  "@3": { t: "list", items: [1, 2], n: 2 },
  "@4": { t: "list", items: [3, 4], n: 2 },
  "@5": { t: "dict", entries: [[0, { ref: "@6" }], [1, { ref: "@7" }]], n: 2 },
  "@6": { t: "list", items: [1], n: 1 },
  "@7": { t: "list", items: [0], n: 1 },
  "@8": { t: "node", cls: "ListNode", fields: { val: 1, next: { ref: "@9" } } },
  "@9": { t: "node", cls: "ListNode", fields: { val: 2, next: null } },
  "@10": { t: "node", cls: "TreeNode", fields: { val: 1, left: { ref: "@11" }, right: null } },
  "@11": { t: "node", cls: "TreeNode", fields: { val: 2, left: null, right: null } },
  "@12": { t: "dict", entries: [["a", 1]], n: 1 },
};

describe("shapes", () => {
  it("detects arrays, matrices, dicts, graphs and nodes", () => {
    expect(detectShape(heap["@1"], heap)).toBe("array");
    expect(detectShape(heap["@2"], heap)).toBe("matrix");
    expect(detectShape(heap["@2"], heap, { names: ["graph"] })).toBe("graph");
    expect(detectShape(heap["@5"], heap, { names: ["adj"] })).toBe("graph");
    expect(detectShape(heap["@12"], heap)).toBe("dict");
    expect(detectShape(heap["@8"], heap)).toBe("list-node");
    expect(detectShape(heap["@10"], heap)).toBe("tree-node");
  });

  it("finds reachable objects and pointer labels", () => {
    const state: TraceState = { stack: [{ id: 1, fn: "f", line: 1 }], locals: { "1": { nums: { ref: "@1" }, head: { ref: "@8" }, i: 0 } }, heap, stdout: "" };
    const r = reachable(state);
    expect([...r].sort()).toEqual(["@1", "@8", "@9"]);
    expect(pointerLabels(state)["@8"]).toEqual([{ name: "head", frameId: 1 }]);
  });

  it("builds linked-list chains from heads", () => {
    const chains = listChains(["@8", "@9"], heap);
    expect(chains).toEqual([{ head: "@8", nodes: ["@8", "@9"], cyclic: false }]);
  });

  it("lays out trees top-down with the root above its children", () => {
    expect(treeRoots(["@10", "@11"], heap)).toEqual(["@10"]);
    const l = layoutTree("@10", heap);
    const root = l.nodes.find((n) => n.id === "@10")!, child = l.nodes.find((n) => n.id === "@11")!;
    expect(root.y).toBeLessThan(child.y);
    expect(child.x).toBeLessThan(root.x); // left child sits left of the root
    expect(root.label).toBe("1");
  });

  it("lays out graphs from adjacency dicts", () => {
    const g = layoutGraph("@5", heap)!;
    expect(g.nodes.map((n) => n.label)).toEqual(["0", "1"]);
    expect(g.edges).toEqual([{ from: "0", to: "1" }]);
  });

  it("extracts index variables from source", () => {
    const iv = indexVariables("nums[i] + nums[j - 1] and grid[r][c]");
    expect([...iv.nums]).toEqual(["i", "j"]);
    expect([...iv.grid]).toEqual(["r"]);
  });
});
