import { describe, expect, it } from "vitest";
import { K_EARLY, K_LATE, PROBLEM_MAX, PROBLEM_MIN, applyRating, difficultyForRating, expectedScore, kFor, ratedOutcomeFor, shiftDifficulty } from "./rating";

describe("Elo rating (P-05)", () => {
  it("expected score is 0.5 at equal rating and symmetric", () => {
    expect(expectedScore(1200, 1200)).toBe(0.5);
    expect(expectedScore(1400, 1200) + expectedScore(1200, 1400)).toBeCloseTo(1, 10);
  });

  it("K schedule: 32 below 30 rated solves, then 16", () => {
    expect(kFor(0)).toBe(K_EARLY);
    expect(kFor(29)).toBe(K_EARLY);
    expect(kFor(30)).toBe(K_LATE);
  });

  it("first-try AC on an equal problem: +16 user, −4 problem", () => {
    const r = applyRating(1200, 1200, 0, { kind: "first-try-ac" });
    expect(r.user).toBe(1216);
    expect(r.problem).toBe(1196);
    expect(r.delta).toBe(16);
  });

  it("later AC scores 0.7; failing out scores 0", () => {
    const later = applyRating(1200, 1200, 0, { kind: "later-ac" });
    expect(later.delta).toBeCloseTo(32 * 0.2, 5);
    const fail = applyRating(1200, 1200, 0, { kind: "failed-out" });
    expect(fail.user).toBe(1184);
    expect(fail.problem).toBe(1204);
  });

  it("problem rating stays within 800..2600", () => {
    expect(applyRating(3000, PROBLEM_MIN, 0, { kind: "first-try-ac" }).problem).toBe(PROBLEM_MIN);
    expect(applyRating(400, PROBLEM_MAX, 0, { kind: "failed-out" }).problem).toBe(PROBLEM_MAX);
  });

  it("rated outcome fires once per (user, problem)", () => {
    expect(ratedOutcomeFor({ accepted: true, attemptNumber: 1, alreadyAccepted: false })).toEqual({ kind: "first-try-ac" });
    expect(ratedOutcomeFor({ accepted: true, attemptNumber: 2, alreadyAccepted: false })).toEqual({ kind: "later-ac" });
    expect(ratedOutcomeFor({ accepted: false, attemptNumber: 1, alreadyAccepted: false })).toBeNull();
    expect(ratedOutcomeFor({ accepted: false, attemptNumber: 3, alreadyAccepted: false })).toEqual({ kind: "failed-out" });
    expect(ratedOutcomeFor({ accepted: true, attemptNumber: 4, alreadyAccepted: false })).toBeNull();
    expect(ratedOutcomeFor({ accepted: true, attemptNumber: 2, alreadyAccepted: true })).toBeNull();
  });

  it("difficulty band is the seed closest to rating + 100", () => {
    expect(difficultyForRating(1200)).toBe("Easy");    // 1300 → Easy(1100) is 200 away, Medium(1500) 200 — tie keeps Easy
    expect(difficultyForRating(1250)).toBe("Medium");
    expect(difficultyForRating(1650)).toBe("Hard");
    expect(difficultyForRating(900)).toBe("Easy");
  });

  it("shiftDifficulty clamps", () => {
    expect(shiftDifficulty("Easy", -1)).toBe("Easy");
    expect(shiftDifficulty("Easy", 1)).toBe("Medium");
    expect(shiftDifficulty("Hard", 1)).toBe("Hard");
  });
});
