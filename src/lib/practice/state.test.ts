import { describe, expect, it } from "vitest";
import { computePracticeState, getCalibrationSpec, getSessionGuidance, getStateGuidance, getStateProgress, shouldStartCalibration } from "./state";
import { TODAY, makeUser, practiced, skill } from "./_fixtures";

const dueSkill = (mastery: number) => practiced(mastery, { srs: { interval: 3, ease: 2.5, nextReview: "2026-09-01", reps: 2 } });

describe("practice state machine (P-04)", () => {
  it("brand-new: beginner → warm-up, others → learning", () => {
    expect(computePracticeState(makeUser({ experienceLevel: "beginner" }), TODAY)).toBe("warm-up");
    expect(computePracticeState(makeUser({ experienceLevel: "intermediate" }), TODAY)).toBe("learning");
  });

  it("returning after ≥ 14 days (by stats.lastActiveDate) → warm-up and calibration starts", () => {
    const u = makeUser({ stats: { totalSolved: 12, totalFailed: 2, lastActiveDate: "2026-08-10" } });
    expect(computePracticeState(u, TODAY)).toBe("warm-up");
    expect(shouldStartCalibration(u, TODAY)).toBe(true);
    const active = makeUser({ stats: { totalSolved: 12, totalFailed: 2, lastActiveDate: "2026-09-07" } });
    expect(shouldStartCalibration(active, TODAY)).toBe(false);
  });

  it("incomplete calibration keeps warm-up until the 3 steps are done", () => {
    const u = makeUser({ stats: { totalSolved: 12, lastActiveDate: TODAY }, calibration: { complete: false, step: 1 } });
    expect(computePracticeState(u, TODAY)).toBe("warm-up");
    expect(getStateProgress(u, TODAY)).toMatch(/2 more calibration/);
  });

  it("learning exits at 10 solved, not 10 attempts", () => {
    const attempts = makeUser({ stats: { totalSolved: 4, totalFailed: 8, lastActiveDate: TODAY } });
    expect(computePracticeState(attempts, TODAY)).toBe("learning");
    const solved = makeUser({ stats: { totalSolved: 10, totalFailed: 0, lastActiveDate: TODAY }, topicSkills: { array: practiced(80, { solved: 10 }) } });
    expect(computePracticeState(solved, TODAY)).toBe("maintenance");
  });

  it("weak topics or pass rate < 60% → strengthening", () => {
    const weak = makeUser({ stats: { totalSolved: 12, totalFailed: 2, lastActiveDate: TODAY }, topicSkills: { array: practiced(30) } });
    expect(computePracticeState(weak, TODAY)).toBe("strengthening");
    const lowRate = makeUser({ stats: { totalSolved: 10, totalFailed: 10, lastActiveDate: TODAY }, topicSkills: { array: practiced(80) } });
    expect(computePracticeState(lowRate, TODAY)).toBe("strengthening");
  });

  it("≥ 3 due topics, or 1 due + 2 weak → revision", () => {
    const three = makeUser({ stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: { a: dueSkill(80), b: dueSkill(80), c: dueSkill(80) } });
    expect(computePracticeState(three, TODAY)).toBe("revision");
    const mixed = makeUser({ stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: { a: dueSkill(80), b: practiced(30), c: practiced(40) } });
    expect(computePracticeState(mixed, TODAY)).toBe("revision");
  });

  it("interview-prep goal wins unless ≥ 5 topics are due", () => {
    const skills = { a: dueSkill(80), b: dueSkill(80), c: dueSkill(80), d: dueSkill(80) };
    const four = makeUser({ goalType: "interview-prep", stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: skills });
    expect(computePracticeState(four, TODAY)).toBe("interview-prep");
    const five = makeUser({ goalType: "interview-prep", stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: { ...skills, e: dueSkill(80) } });
    expect(computePracticeState(five, TODAY)).toBe("revision");
  });

  it("guidance per state", () => {
    expect(getStateGuidance("warm-up", "daily-practice")).toMatchObject({ difficultyBias: "Easy", topicStrategy: "familiar" });
    expect(getStateGuidance("learning", "daily-practice").topicStrategy).toBe("new-topics");
    expect(getStateGuidance("strengthening", "daily-practice").topicStrategy).toBe("weak-first");
    expect(getStateGuidance("revision", "daily-practice").difficultyBias).toBe("Easy");
    expect(getStateGuidance("interview-prep", "interview-prep").difficultyBias).toBe("Medium");
    expect(getStateGuidance("maintenance", "daily-practice").topicStrategy).toBe("mixed");
  });

  it("calibration spec: easy familiar → medium familiar → easy weakest → done", () => {
    const u = makeUser({ topicSkills: { array: practiced(85), string: practiced(70), graph: practiced(20) } });
    expect(getCalibrationSpec(u, 0)).toMatchObject({ difficulty: "Easy", topic: "array" });
    expect(getCalibrationSpec(u, 1)).toMatchObject({ difficulty: "Medium", topic: "string" });
    expect(getCalibrationSpec(u, 2)).toMatchObject({ difficulty: "Easy", topic: "graph" });
    expect(getCalibrationSpec(u, 3)).toBeNull();
    expect(getCalibrationSpec(makeUser({ topicSkills: { x: skill() } }), 0)?.topic).toBe("array");
  });

  it("session guidance from the client health score", () => {
    expect(getSessionGuidance(undefined).difficultyAdjust).toBe(0);
    expect(getSessionGuidance(20)).toMatchObject({ difficultyAdjust: -1, shouldSuggestBreak: true });
    expect(getSessionGuidance(50)).toMatchObject({ difficultyAdjust: -1, shouldSuggestBreak: false });
    expect(getSessionGuidance(75).difficultyAdjust).toBe(0);
    expect(getSessionGuidance(95).difficultyAdjust).toBe(1);
  });

  it("state progress messages", () => {
    expect(getStateProgress(makeUser({ stats: { totalSolved: 3, lastActiveDate: TODAY } }), TODAY)).toMatch(/Solve 7 more/);
    expect(getStateProgress(makeUser({ stats: { totalSolved: 12, lastActiveDate: TODAY }, topicSkills: { graph: practiced(30) } }), TODAY)).toMatch(/graph/);
  });
});
