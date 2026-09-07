import { describe, expect, it } from "vitest";
import { applyOutcomeToSkill, averageMastery, computeMastery, emptyTopicSkill, isMastered, isWeak, masteryBreakdown, struggleAdjust, timeEfficiencyFor, weakTopics } from "./mastery";
import { skill } from "./_fixtures";

const clean = (difficulty: "Easy" | "Medium" | "Hard", timeSpentSec = 300) => ({
  accepted: true, difficulty, isFirstTry: true, hintsUsed: 0, runCount: 1, editorialViewed: false, timeSpentSec, firstAccept: true,
});

describe("mastery v2 (P-02)", () => {
  it("is 0 for an unpracticed topic", () => {
    expect(computeMastery(emptyTopicSkill())).toBe(0);
  });

  it("a single lucky AC cannot exceed 60", () => {
    const s = applyOutcomeToSkill(emptyTopicSkill(), clean("Easy", 120));
    expect(s.mastery).toBeLessThanOrEqual(60);
    expect(s.solved).toBe(1);
    expect(s.easy).toBe(1);
  });

  it("three clean solves across difficulties reach 90+", () => {
    let s = emptyTopicSkill();
    s = applyOutcomeToSkill(s, clean("Easy", 300));
    s = applyOutcomeToSkill(s, clean("Medium", 600));
    s = applyOutcomeToSkill(s, clean("Hard", 1200));
    // volume factor: 3/6 — breadth, accuracy, first-try, speed and independence are all maxed
    expect(s.mastery).toBeGreaterThanOrEqual(90);
  });

  it("five clean mixed-difficulty ACs reach 85+", () => {
    let s = emptyTopicSkill();
    for (const d of ["Easy", "Medium", "Hard", "Medium", "Easy"] as const) s = applyOutcomeToSkill(s, clean(d, 400));
    expect(s.mastery).toBeGreaterThanOrEqual(85);
  });

  it("firstTryRate never exceeds 1 (C11)", () => {
    const b = masteryBreakdown(skill({ solved: 2, attempts: 5, failed: 3, firstTrySuccesses: 4 }));
    expect(b.firstTryRate).toBe(1);
  });

  it("has no recency term: an idle month does not change mastery", () => {
    const s = skill({ solved: 4, attempts: 5, failed: 1, easy: 2, medium: 2, firstTrySuccesses: 3, timeEfficiency: 1 });
    const m1 = computeMastery(s);
    const m2 = computeMastery({ ...s, lastSeen: null });
    expect(m1).toBe(m2);
  });

  it("penalises hints and editorial views through independence", () => {
    const base = skill({ solved: 4, attempts: 4, easy: 4, firstTrySuccesses: 4 });
    const hinted = { ...base, hintsUsed: 12 };
    const editorial = { ...base, editorialViews: 4 };
    expect(computeMastery(hinted)).toBeLessThan(computeMastery(base));
    expect(computeMastery(editorial)).toBeLessThan(computeMastery(base));
  });

  it("struggle adjustment: brute force ×0.85, clean first try ×1.10", () => {
    expect(struggleAdjust(60, { accepted: true, runCount: 20, difficulty: "Easy", isFirstTry: false })).toBe(51);
    expect(struggleAdjust(60, { accepted: true, runCount: 1, difficulty: "Easy", isFirstTry: true })).toBe(66);
    expect(struggleAdjust(60, { accepted: false, runCount: 20, difficulty: "Easy", isFirstTry: false })).toBe(60);
  });

  it("time efficiency is expected/actual clamped to [0.3, 2]", () => {
    expect(timeEfficiencyFor("Easy", 600)).toBe(1);
    expect(timeEfficiencyFor("Medium", 60)).toBe(2);
    expect(timeEfficiencyFor("Hard", 100_000)).toBe(0.3);
    expect(timeEfficiencyFor("Hard", 0)).toBe(1);
  });

  it("a failure keeps counters honest", () => {
    const s = applyOutcomeToSkill(emptyTopicSkill(), { ...clean("Medium"), accepted: false, isFirstTry: false, firstAccept: false });
    expect(s.failed).toBe(1);
    expect(s.solved).toBe(0);
    expect(s.medium).toBe(0);
    expect(s.mastery).toBeLessThan(30);
  });

  it("weak / mastered helpers and averages", () => {
    const skills = { a: skill({ attempts: 2, solved: 1, mastery: 30 }), b: skill({ attempts: 6, solved: 5, mastery: 85 }), c: skill() };
    expect(isWeak(skills.a)).toBe(true);
    expect(isWeak(skills.c)).toBe(false);
    expect(isMastered(skills.b)).toBe(true);
    expect(isMastered(skill({ solved: 1, mastery: 90 }))).toBe(false);
    expect(weakTopics(skills)).toEqual(["a"]);
    expect(averageMastery(skills)).toBe(57.5);
  });
});
