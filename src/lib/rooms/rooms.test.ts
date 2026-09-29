import { describe, expect, it } from "vitest";
import { RoomSettingsSchema, defaultSettings, expandSlots, rampDifficulties, summarize } from "@/lib/rooms/settings";
import { decayFactor, rank, scoreMember, scoreProblem } from "@/lib/rooms/scoring";
import { PENALTY_CAP, penaltyFor, rulesFor, summarizeEvents } from "@/lib/rooms/integrity";
import { codeSimilarity, pairwiseSimilarity, tokenize } from "@/lib/rooms/similarity";
import { ratingDeltas } from "@/lib/rooms/rating";
import { budgetLevel, canStart, estimateBatches } from "@/lib/rooms/budget";
import { formatCode, generateCode, normalizeCode } from "@/lib/rooms/codes";

describe("room settings", () => {
  it("applies defaults and validates per-problem arrays", () => {
    const s = defaultSettings({ name: "Friday clash" });
    expect(s.count).toBe(3);
    expect(s.caps.maxSubmitsPerProblem).toBe(3);
    expect(() => RoomSettingsSchema.parse({ name: "x" })).toThrow();
    expect(() => RoomSettingsSchema.parse({ name: "Room A", count: 2, difficultyMode: "perProblem", perProblemDifficulty: ["Easy"] })).toThrow(/each of the 2/);
    expect(() => RoomSettingsSchema.parse({ name: "Room A", topicMode: "pool", topicPool: [] })).toThrow(/at least one topic/);
    expect(() => RoomSettingsSchema.parse({ name: "Room A", topicMode: "pool", topicPool: ["quantum"] })).toThrow(/Unknown topics/);
  });
  it("ramps difficulties and expands slots", () => {
    expect(rampDifficulties(1)).toEqual(["Medium"]);
    expect(rampDifficulties(3)).toEqual(["Easy", "Medium", "Hard"]);
    expect(rampDifficulties(6)).toEqual(["Easy", "Easy", "Medium", "Medium", "Hard", "Hard"]);
    const s = defaultSettings({ name: "Room A", count: 2, topicMode: "perProblem", perProblemTopics: [["array"], ["graph", "bfs"]] });
    expect(expandSlots(s)).toEqual([{ index: 0, difficulty: "Easy", topics: ["array"] }, { index: 1, difficulty: "Medium", topics: ["graph", "bfs"] }]);
    expect(summarize(s).join(" ")).toContain("2 problems");
  });
});

describe("scoring", () => {
  const s = defaultSettings({ name: "Room A", durationMin: 60 });
  const start = 1_000_000;
  const p = { problemId: "p1", difficulty: "Medium" as const, points: 200 };
  it("decays linearly to minPct", () => {
    expect(decayFactor(s, start, start)).toBe(1);
    expect(decayFactor(s, start, start + 60 * 60_000)).toBeCloseTo(0.5);
    expect(decayFactor(s, start, start + 30 * 60_000)).toBeCloseTo(0.75);
  });
  it("scores a first-try accept, wrong penalties and partial credit", () => {
    const ac = scoreProblem(s, p, [{ problemId: "p1", verdict: "AC", passed: 10, total: 10, at: start + 30 * 60_000 }], start);
    expect(ac.points).toBe(150);
    const wrongThenAc = scoreProblem(s, p, [
      { problemId: "p1", verdict: "WA", passed: 3, total: 10, at: start + 10 * 60_000 },
      { problemId: "p1", verdict: "CE", passed: 0, total: 0, at: start + 11 * 60_000 },
      { problemId: "p1", verdict: "AC", passed: 10, total: 10, at: start + 30 * 60_000 },
    ], start);
    expect(wrongThenAc.wrong).toBe(1); // CE is free
    expect(wrongThenAc.points).toBe(130); // 150 - 10% of 200
    const none = scoreProblem(s, p, [{ problemId: "p1", verdict: "WA", passed: 5, total: 10, at: start }], start);
    expect(none.points).toBe(0);
    const partial = scoreProblem({ ...s, scoring: { ...s.scoring, partialCredit: "proportional" } }, p, [{ problemId: "p1", verdict: "WA", passed: 5, total: 10, at: start }], start);
    expect(partial.points).toBe(50);
    expect(partial.status).toBe("attempting");
  });
  it("applies the integrity penalty and ranks with ties", () => {
    const m = scoreMember(s, [p], [{ problemId: "p1", verdict: "AC", passed: 10, total: 10, at: start + 30 * 60_000 }], start, 20);
    expect(m.raw).toBe(150); expect(m.final).toBe(120); expect(m.solved).toBe(1); expect(m.totalTimeSec).toBe(1800);
    const ranked = rank([
      { uid: "a", state: "accepted", score: { final: 100, solved: 1, totalTimeSec: 600, wrongSubmissions: 0 }, violations: 0, joinedAt: 1 },
      { uid: "b", state: "accepted", score: { final: 100, solved: 1, totalTimeSec: 600, wrongSubmissions: 0 }, violations: 0, joinedAt: 2 },
      { uid: "c", state: "left", score: { final: 90, solved: 1, totalTimeSec: 100, wrongSubmissions: 0 }, violations: 0, joinedAt: 3 },
      { uid: "d", state: "kicked", score: { final: 999, solved: 3, totalTimeSec: 1, wrongSubmissions: 0 }, violations: 0, joinedAt: 0 },
    ]);
    expect(ranked.map((r) => [r.member.uid, r.rank])).toEqual([["a", 1], ["b", 1], ["c", 3], ["d", null]]);
  });
});

describe("integrity", () => {
  it("penalises by strictness and ignores short absences", () => {
    expect(penaltyFor({ type: "tab_hidden", meta: { durationMs: 3000 } }, 0, "standard")).toBeNull();
    expect(penaltyFor({ type: "tab_hidden", meta: { durationMs: 40_000 } }, 0, "standard")).toBe(4);
    expect(penaltyFor({ type: "tab_hidden", meta: { durationMs: 600_000 } }, 0, "standard")).toBe(10);
    expect(penaltyFor({ type: "paste_external", meta: { chars: 50 } }, 0, "standard")).toBe(8);
    expect(penaltyFor({ type: "paste_external", meta: { chars: 50 } }, 2, "standard")).toBe(16);
    expect(penaltyFor({ type: "paste_external", meta: { chars: 500 } }, 0, "lenient")).toBe(6);
    expect(penaltyFor({ type: "heartbeat" }, 0, "strict")).toBe(0);
    expect(rulesFor("standard").some((r) => r.type === "devtools")).toBe(false);
    expect(rulesFor("strict").some((r) => r.type === "devtools")).toBe(true);
  });
  it("caps the total", () => {
    const events = Array.from({ length: 20 }, () => ({ type: "paste_external" as const, meta: { chars: 10 } }));
    const sum = summarizeEvents(events, "standard");
    expect(sum.penaltyPct).toBe(PENALTY_CAP);
    expect(sum.count).toBe(20);
    expect(sum.byType.paste_external).toBe(20);
  });
});

describe("similarity", () => {
  const a = `class Solution { public int[] twoSum(int[] nums, int target) { Map<Integer,Integer> seen = new HashMap<>(); for (int i = 0; i < nums.length; i++) { int need = target - nums[i]; if (seen.containsKey(need)) return new int[]{seen.get(need), i}; seen.put(nums[i], i); } return new int[0]; } }`;
  const renamed = `class Solution { public int[] twoSum(int[] arr, int t) { Map<Integer,Integer> m = new HashMap<>(); for (int k = 0; k < arr.length; k++) { int rest = t - arr[k]; if (m.containsKey(rest)) return new int[]{m.get(rest), k}; m.put(arr[k], k); } return new int[0]; } }`;
  const brute = `class Solution { public int[] twoSum(int[] nums, int target) { for (int i = 0; i < nums.length; i++) for (int j = i + 1; j < nums.length; j++) if (nums[i] + nums[j] == target) return new int[]{i, j}; throw new IllegalArgumentException("no"); } }`;
  it("normalises identifiers and strings", () => {
    expect(tokenize("int x = 5; String s = \"hi\"; // c", "java")).toEqual(["int", "ID", "=", "N", ";", "String", "ID", "=", "S", ";"]);
  });
  it("flags renamed copies and not unrelated solutions", () => {
    expect(codeSimilarity(a, renamed, "java")).toBeGreaterThanOrEqual(0.95);
    expect(codeSimilarity(a, brute, "java")).toBeLessThan(0.5);
  });
  it("pairs submissions per problem and exonerates the earlier one after 10 minutes", () => {
    const flags = pairwiseSimilarity([
      { uid: "u1", problemId: "p", language: "java", code: a, at: 0 },
      { uid: "u2", problemId: "p", language: "java", code: renamed, at: 15 * 60_000 },
      { uid: "u3", problemId: "p", language: "java", code: brute, at: 5 * 60_000 },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ a: "u1", b: "u2", level: "strong", later: "u2" });
  });
});

describe("rating & budget & codes", () => {
  it("rewards the winner and needs 3 finishers", () => {
    expect(ratingDeltas([{ uid: "a", rating: 1500, contests: 0, rank: 1 }, { uid: "b", rating: 1500, contests: 0, rank: 2 }])).toBeNull();
    const d = ratingDeltas([{ uid: "a", rating: 1500, contests: 0, rank: 1 }, { uid: "b", rating: 1500, contests: 0, rank: 2 }, { uid: "c", rating: 1500, contests: 10, rank: 3 }])!;
    expect(d.a).toBeGreaterThan(0); expect(d.c).toBeLessThan(0); expect(Math.abs(d.c)).toBeLessThan(Math.abs(d.a)); // late K smaller
    const demoted = ratingDeltas([{ uid: "a", rating: 1500, contests: 0, rank: 1, demoted: true }, { uid: "b", rating: 1500, contests: 0, rank: 2 }, { uid: "c", rating: 1500, contests: 0, rank: 3 }])!;
    expect(demoted.a).toBeLessThan(0);
  });
  it("estimates the judge budget", () => {
    const est = estimateBatches(6, 3, { maxSubmitsPerProblem: 3, maxRunsPerProblem: 3 });
    expect(est).toEqual({ need: 108, likely: 40 });
    expect(budgetLevel(est, 45, 45)).toBe("over");
    expect(budgetLevel(est, 200, 300)).toBe("ok");
    expect(budgetLevel(est, 45, 0)).toBe("unlimited");
    expect(canStart(est, 45, 45, 15).ok).toBe(false);
    expect(canStart(est, 60, 100, 15).ok).toBe(true);
  });
  it("codes", () => {
    let i = 0; const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.99];
    expect(generateCode(() => seq[i++])).toBe("123459");
    expect(normalizeCode(" 123 456 ")).toBe("123456");
    expect(normalizeCode("12345")).toBeNull();
    expect(formatCode("123456")).toBe("123 456");
  });
});
