import { describe, expect, it } from "vitest";
import { CORE_TOPICS, difficultyInText, normalizeTags, topicsInText } from "./topics";

describe("topics", () => {
  it("normalises aliases and drops unknown tags", () => {
    expect(normalizeTags(["Arrays", "Hash-Table", "prefix sum", "nonsense", "array"])).toEqual(["array", "hash map"]);
  });
  it("finds topics and difficulty in a free-text prompt", () => {
    expect(topicsInText("medium sliding window with a hash map")).toEqual(["sliding window", "hash map"]);
    expect(topicsInText("something about DP and BFS").sort()).toEqual(["bfs", "dynamic programming"]);
    expect(topicsInText("nothing here")).toEqual([]);
    expect(difficultyInText("give me a Hard graph problem")).toBe("Hard");
    expect(difficultyInText("sliding window")).toBeNull();
  });
  it("has 25 core topics", () => expect(CORE_TOPICS.length).toBe(25));
});
