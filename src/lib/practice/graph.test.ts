import { describe, expect, it } from "vitest";
import { CORE_TOPICS, PREREQUISITES, TOPIC_META, assertPrerequisitesAcyclic, getPrerequisites, getTopicDepth, getTopologicalOrder } from "./topics";

describe("prerequisite DAG (P-01)", () => {
  it("is acyclic and references only core topics", () => {
    expect(() => assertPrerequisitesAcyclic()).not.toThrow();
  });
  it("contains the three additions from the spec", () => {
    expect(PREREQUISITES.heap).toEqual(["array"]);
    expect(PREREQUISITES.matrix).toEqual(["array"]);
    expect(PREREQUISITES["bit manipulation"]).toEqual(["math"]);
  });
  it("keeps the v1 edges", () => {
    expect(getPrerequisites("dfs")).toEqual(["graph", "stack", "recursion"]);
    expect(getPrerequisites("Dynamic Programming")).toEqual(["recursion", "array"]);
    expect(getPrerequisites("array")).toEqual([]);
  });
  it("computes depth and a topological order (prerequisites first)", () => {
    expect(getTopicDepth("array")).toBe(0);
    expect(getTopicDepth("bfs")).toBe(2);
    expect(getTopicDepth("bst")).toBeGreaterThanOrEqual(3);
    const order = getTopologicalOrder();
    expect(order.length).toBe(CORE_TOPICS.length);
    for (const t of order) for (const p of getPrerequisites(t)) expect(order.indexOf(p)).toBeLessThan(order.indexOf(t));
  });
  it("has display metadata for every core topic", () => {
    for (const t of CORE_TOPICS) {
      expect(TOPIC_META[t].name.length).toBeGreaterThan(2);
      expect(TOPIC_META[t].icon.length).toBeGreaterThan(2);
      expect(TOPIC_META[t].description.length).toBeGreaterThan(10);
    }
  });
});
