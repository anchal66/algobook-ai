import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import type { TemplatePoolEntry, WithId } from "@/lib/data/schema";
import { banditScore, prerequisiteGap, recentTags, recommendPure, rng, scoreTemplatePool, summarizeForPrompt, templateRecommendation, topicsFromTitle, type RecommendPureInput } from "./recommend";
import { CORE_TOPICS } from "./topics";
import { TODAY, makeUser, practiced, skill, type UserOverrides } from "./_fixtures";

const project = { experienceLevel: "intermediate" as const, goalType: "daily-practice" as const, selectedTopics: [] as string[], templateId: null };
const item = (tags: string[], difficulty: "Easy" | "Medium" | "Hard" = "Easy") => ({ tags, title: tags.join(" "), difficulty, status: "solved" as const });

function rec(user: UserOverrides, over: Partial<RecommendPureInput> = {}) {
  return recommendPure({ user: makeUser(user), project, existingItems: [], today: TODAY, seed: 42, ...over });
}

describe("recommender v2 (P-06)", () => {
  it("is deterministic for a seed and varies across seeds", () => {
    const u = { stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: { array: practiced(85), string: practiced(80) } };
    const a = rec(u, { seed: 7 });
    const b = rec(u, { seed: 7 });
    expect(a).toEqual(b);
    const picks = new Set(Array.from({ length: 20 }, (_, i) => rec(u, { seed: i }).topics[0]));
    expect(picks.size).toBeGreaterThan(1);
  });

  it("fresh intermediate user: Easy/Medium with a new-topic reason", () => {
    const r = rec({});
    expect(["Easy", "Medium"]).toContain(r.difficulty);
    expect(r.strategy).toBe("new-topics");
    expect(r.reason.short).toMatch(/^New topic:/);
    expect(r.isCalibration).toBe(false);
    expect(r.rationaleFacts.length).toBeGreaterThan(1);
    expect(r.promptTopicsForPool.length).toBeGreaterThan(0);
  });

  it("graph mastery 20 and dfs requested → graph prerequisite with the documented reason", () => {
    const skills = { graph: practiced(20, { solved: 1, attempts: 3 }), stack: practiced(70), recursion: practiced(70) };
    const r = rec({ stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: skills }, { topicFilter: ["dfs"] });
    expect(r.topics).toEqual(["graph"]);
    expect(r.reason.short).toBe("Prerequisite: graph");
    expect(r.reason.detail).toMatch(/prerequisite for "dfs"/);
    expect(r.reason.detail).toMatch(/only 20%/);
    expect(r.difficulty).not.toBe("Hard");
  });

  it("does not redirect for a prerequisite with ≥ 2 solves (one unlucky fail)", () => {
    const skills = { graph: practiced(40, { solved: 2, attempts: 5 }), stack: practiced(70), recursion: practiced(70) };
    expect(prerequisiteGap(skills, "dfs")).toBeNull();
    const r = rec({ stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: skills }, { topicFilter: ["dfs"] });
    expect(r.topics[0]).toBe("dfs");
  });

  it("fresh user: new topics are introduced prerequisites-first (depth-0 topics)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) seen.add(rec({}, { seed: i }).topics[0]);
    for (const t of seen) expect(prerequisiteGap({}, t)).toBeNull();
    expect(seen.size).toBeGreaterThan(2);
  });

  it("unpracticed prerequisite redirects with the 'not practised yet' copy", () => {
    const r = rec({ stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: { array: practiced(80, { solved: 12 }) } }, { topicFilter: ["dynamic programming"] });
    expect(r.topics).toEqual(["recursion"]);
    expect(r.reason.detail).toMatch(/haven't practised it yet/);
  });

  it("returning user gets calibration step 1/3 and asks the route to start calibration", () => {
    const r = rec({ stats: { totalSolved: 12, totalFailed: 3, lastActiveDate: "2026-08-01" }, topicSkills: { array: practiced(85), string: practiced(60) } });
    expect(r.isCalibration).toBe(true);
    expect(r.startCalibration).toBe(true);
    expect(r.reason.short).toBe("Calibration step 1/3");
    expect(r).toMatchObject({ difficulty: "Easy", topics: ["array"] });
    const step2 = rec({ stats: { totalSolved: 12, totalFailed: 3, lastActiveDate: TODAY }, calibration: { complete: false, step: 1 }, topicSkills: { array: practiced(85), string: practiced(60) } });
    expect(step2.reason.short).toBe("Calibration step 2/3");
    expect(step2.difficulty).toBe("Medium");
  });

  it("strengthening picks weak topics first (≥ 15 of 20 seeds)", () => {
    const u = { stats: { totalSolved: 12, totalFailed: 2, lastActiveDate: TODAY }, topicSkills: { array: practiced(85, { solved: 8 }), "hash map": practiced(30, { solved: 2, attempts: 5 }) } };
    let hits = 0;
    for (let i = 0; i < 20; i++) {
      const r = rec(u, { seed: i, topicFilter: ["array", "hash map"] });
      expect(r.state).toBe("strengthening");
      if (r.topics[0] === "hash map") { hits += 1; expect(r.reason.short).toBe("Weak topic: hash map"); }
    }
    expect(hits).toBeGreaterThanOrEqual(15);
  });

  it("revision prefers due topics and biases Easy", () => {
    const due = (m: number) => practiced(m, { srs: { interval: 3, ease: 2.5, nextReview: "2026-09-01", reps: 2 } });
    const r = rec({ stats: { totalSolved: 12, lastActiveDate: TODAY, rating: 1500 }, topicSkills: { array: due(80), string: due(80), stack: due(80) } });
    expect(r.state).toBe("revision");
    expect(["array", "string", "stack"]).toContain(r.topics[0]);
    expect(r.reason.short).toMatch(/^Spaced review:/);
    expect(r.difficulty).toBe("Easy");
  });

  it("interview-prep goal uses interview patterns at ≥ Medium", () => {
    const skills: Record<string, ReturnType<typeof practiced>> = {};
    for (const t of CORE_TOPICS) skills[t] = practiced(70, { solved: 4, attempts: 5 });
    const r = rec({ goalType: "interview-prep", stats: { totalSolved: 100, lastActiveDate: TODAY, rating: 1000 }, topicSkills: skills });
    expect(r.state).toBe("interview-prep");
    expect(r.difficulty).toBe("Medium");
    expect(r.reason.short).toMatch(/^Interview pattern:/);
  });

  it("difficulty follows the Elo band and the session-health adjust is clamped to one level", () => {
    const u = { stats: { totalSolved: 12, lastActiveDate: TODAY, rating: 1750 }, topicSkills: { array: practiced(90, { solved: 12 }), string: practiced(90, { solved: 12 }) } };
    const base = rec(u, { topicFilter: ["array", "string"] });
    expect(base.difficulty).toBe("Hard");
    const tired = rec(u, { sessionHealthScore: 20, topicFilter: ["array", "string"] });
    expect(tired.difficulty).toBe("Medium");
    expect(tired.sessionMessage).toMatch(/break/);
    const wired = rec({ ...u, stats: { ...u.stats, rating: 1000 } }, { sessionHealthScore: 95, topicFilter: ["array", "string"] });
    expect(wired.difficulty).toBe("Medium");
    expect(wired.rationaleFacts.join(" ")).toMatch(/Session health 95/);
  });

  it("topic filter constrains topics and is mentioned in the facts", () => {
    const r = rec({ stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: { array: practiced(85, { solved: 12 }) } }, { topicFilter: ["stack", "queue"] });
    expect(["stack", "queue"]).toContain(r.topics[0]);
    expect(r.rationaleFacts.join(" ")).toMatch(/Constrained to your topics/);
  });

  it("project selectedTopics act as the filter when none is given", () => {
    const r = rec({ stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: { array: practiced(85, { solved: 12 }) } }, { project: { ...project, selectedTopics: ["heap"] } });
    expect(r.topics[0]).toBe("heap");
  });

  it("recency penalty steers away from the last three items' topics", () => {
    const u = { stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: { array: practiced(85, { solved: 12 }), string: practiced(85, { solved: 12 }) } };
    let repeats = 0;
    for (let i = 0; i < 20; i++) {
      const r = rec(u, { seed: i, topicFilter: ["array", "string"], existingItems: [item(["array"]), item(["array"]), item(["array"])] });
      if (r.topics[0] === "array") repeats += 1;
    }
    expect(repeats).toBeLessThanOrEqual(3);
  });

  it("a single-topic filter is honoured even when it repeats", () => {
    const r = rec({ stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: { array: practiced(85, { solved: 12 }) } }, {
      project: { ...project, selectedTopics: ["array"] }, existingItems: [item(["array"]), item(["array"]), item(["array"])],
    });
    expect(r.topics[0]).toBe("array");
  });

  it("user prompt overrides topics and difficulty", () => {
    const r = rec({ stats: { totalSolved: 12, lastActiveDate: TODAY } }, { userPrompt: "give me a hard sliding window problem" });
    expect(r).toMatchObject({ difficulty: "Hard", topics: ["sliding window"], strategy: "prompt" });
    expect(r.reason.short).toBe("Your request: sliding window");
  });

  it("distribution over 100 picks: no topic > 25%, weak topics ≥ 40% while weak exist", () => {
    const skills: Record<string, ReturnType<typeof practiced>> = {};
    for (const t of CORE_TOPICS) skills[t] = practiced(75, { solved: 4, attempts: 5 });
    skills["graph"] = practiced(30, { solved: 1, attempts: 4 });
    skills["heap"] = practiced(35, { solved: 1, attempts: 4 });
    skills["trie"] = practiced(40, { solved: 2, attempts: 5 });
    const counts: Record<string, number> = {};
    let weakHits = 0;
    const items: ReturnType<typeof item>[] = [];
    for (let i = 0; i < 100; i++) {
      const r = rec({ stats: { totalSolved: 100, totalFailed: 20, lastActiveDate: TODAY }, topicSkills: skills }, { seed: i, existingItems: items });
      counts[r.topics[0]] = (counts[r.topics[0]] ?? 0) + 1;
      if (["graph", "heap", "trie"].includes(r.topics[0])) weakHits += 1;
      items.push(item([r.topics[0]])); // simulate the pick being added to the project (recency)
    }
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(25);
    expect(weakHits).toBeGreaterThanOrEqual(40);
  });

  it("distribution for a maintenance user spreads across topics", () => {
    const skills: Record<string, ReturnType<typeof practiced>> = {};
    for (const t of CORE_TOPICS) skills[t] = practiced(80, { solved: 5, attempts: 5 });
    const counts: Record<string, number> = {};
    for (let i = 0; i < 100; i++) {
      const r = rec({ stats: { totalSolved: 125, lastActiveDate: TODAY }, topicSkills: skills }, { seed: i });
      counts[r.topics[0]] = (counts[r.topics[0]] ?? 0) + 1;
    }
    expect(Object.keys(counts).length).toBeGreaterThan(5);
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(25);
  });

  it("bandit favours unpracticed (exploration) and due/weak topics", () => {
    const ranked = banditScore(["a", "b", "c"], {
      skills: { a: practiced(90, { attempts: 50 }), b: practiced(20, { attempts: 3 }), c: skill() },
      due: [{ topic: "a", urgency: 0, overdueDays: 0 }], strategySet: new Set(["b"]), recent: [], rand: rng(1),
    });
    expect(ranked[0].topic).toBe("b");
    expect(ranked.map((r) => r.topic)).toContain("c");
    expect(recentTags([item(["A", "b"]), item(["c"])])).toEqual(["a", "b", "c"]);
  });
});

describe("template recommendation (P-06 template preference)", () => {
  const pool: WithId<TemplatePoolEntry>[] = [
    { id: "e0", title: "Two Sum", number: 1, difficulty: "Easy", order: 0, status: "pending", problemId: null },
    { id: "e1", title: "Merge Intervals", number: 56, difficulty: "Medium", order: 1, status: "pending", problemId: null },
    { id: "e2", title: "Word Ladder", number: 127, difficulty: "Hard", order: 2, status: "pending", problemId: null },
    { id: "e3", title: "Course Schedule", number: 207, difficulty: "Medium", order: 3, status: "pending", problemId: null },
  ];

  it("infers topics from titles", () => {
    expect(topicsFromTitle("Word Ladder")).toEqual(["bfs", "string"]);
    expect(topicsFromTitle("Course Schedule")).toContain("graph");
    expect(topicsFromTitle("Zzz")).toEqual(["array"]);
  });

  it("prefers difficulty match, weak topics and earlier order; a prompt match wins outright", () => {
    const user = makeUser({ stats: { rating: 1500, totalSolved: 20, lastActiveDate: TODAY }, topicSkills: { graph: practiced(30, { solved: 1, attempts: 4 }) } });
    const scored = scoreTemplatePool(user, pool, [], { today: TODAY, seed: 3 });
    expect(scored[0].entry.title).toBe("Course Schedule"); // Medium match + weak graph
    const prompt = scoreTemplatePool(user, pool, [], { today: TODAY, seed: 3, userPrompt: "word ladder" });
    expect(prompt[0].entry.title).toBe("Word Ladder");
    expect(prompt[0].matchedPrompt).toBe(true);
    const recd = templateRecommendation(user, scored[0], "google", [], TODAY);
    expect(recd.templateEntry?.company).toBe("google");
    expect(recd.reason.short).toBe("google list #4");
    expect(recd.strategy).toBe("template");
  });

  it("topic filter narrows the pool and falls back when nothing matches", () => {
    const user = makeUser({ stats: { rating: 1200 } });
    const filtered = scoreTemplatePool(user, pool, [], { today: TODAY, seed: 1, topicFilter: ["sorting"] });
    expect(filtered.length).toBe(1);
    expect(filtered[0].entry.title).toBe("Merge Intervals");
    const none = scoreTemplatePool(user, pool, [], { today: TODAY, seed: 1, topicFilter: ["trie"] });
    expect(none.length).toBe(pool.length);
  });
});

describe("summarizeForPrompt", () => {
  it("is ≤ 400 chars and mentions state, rating, weak/strong/due", () => {
    const skills: Record<string, ReturnType<typeof practiced>> = {};
    for (const t of CORE_TOPICS) skills[t] = practiced(t.length % 2 ? 30 : 85, { srs: { interval: 3, ease: 2.5, nextReview: "2026-09-01", reps: 1 } });
    const s = summarizeForPrompt(makeUser({ stats: { totalSolved: 40, totalFailed: 10, rating: 1350, easy: 20, medium: 15, hard: 5, lastActiveDate: TODAY }, topicSkills: skills }), TODAY);
    expect(s.length).toBeLessThanOrEqual(400);
    expect(s).toMatch(/^state /);
    expect(s).toMatch(/rating 1350/);
    expect(s).toMatch(/weak: /);
    expect(s).toMatch(/strong: /);
    expect(s).toMatch(/due for review: /);
    expect(s).toMatch(/pass rate 80%/);
  });
  it("handles a brand-new user", () => {
    expect(summarizeForPrompt(makeUser({ createdAt: Timestamp.now() }), TODAY)).toMatch(/no submissions yet/);
  });
});
