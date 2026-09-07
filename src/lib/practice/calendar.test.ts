import { describe, expect, it } from "vitest";
import { difficultyForDate, isoWeekOf, longestRun } from "./calendar";
import { assignRanks, entryFromUser, percentileFor } from "./rank";

describe("calendar helpers", () => {
  it("ISO week keys and ranges (Monday..Sunday)", () => {
    expect(isoWeekOf("2026-09-08")).toEqual({ week: "2026-W37", from: "2026-09-07", to: "2026-09-13" });
    expect(isoWeekOf("2026-09-13")).toEqual({ week: "2026-W37", from: "2026-09-07", to: "2026-09-13" });
    expect(isoWeekOf("2027-01-01").week).toBe("2026-W53");
    expect(isoWeekOf("2024-12-30").week).toBe("2025-W01");
  });
  it("longest run of consecutive days", () => {
    expect(longestRun([])).toBe(0);
    expect(longestRun(["2026-09-01"])).toBe(1);
    expect(longestRun(["2026-09-03", "2026-09-01", "2026-09-02", "2026-09-05", "2026-09-06"])).toBe(3);
    expect(longestRun(["2026-09-01", "2026-09-01"])).toBe(1);
  });
  it("daily rotation Easy/Medium/Medium/Hard by weekday", () => {
    // 2026-09-06 is a Sunday (0), Monday 7 → 1, Tuesday 8 → 2, Wednesday 9 → 3, Thursday 10 → 0
    expect(difficultyForDate("2026-09-06")).toBe("Easy");
    expect(difficultyForDate("2026-09-07")).toBe("Medium");
    expect(difficultyForDate("2026-09-08")).toBe("Medium");
    expect(difficultyForDate("2026-09-09")).toBe("Hard");
    expect(difficultyForDate("2026-09-10")).toBe("Easy");
  });
});

describe("ranking helpers (P-11)", () => {
  it("ties share a rank (competition ranking) from a base rank", () => {
    const r = assignRanks([{ score: 90 }, { score: 90 }, { score: 80 }, { score: 80 }, { score: 70 }], 11);
    expect(r.map((x) => x.rank)).toEqual([11, 11, 13, 13, 15]);
    expect(assignRanks([], 1)).toEqual([]);
  });
  it("percentile from rank and total", () => {
    expect(percentileFor(1, 100)).toBe(100);
    expect(percentileFor(50, 100)).toBe(51);
    expect(percentileFor(1, 0)).toBeNull();
  });
  it("builds a leaderboard entry from a user doc with defaults", () => {
    const e = entryFromUser("u1", { username: "ann", stats: { score: 42, totalSolved: 3 } }, 7);
    expect(e).toMatchObject({ uid: "u1", username: "ann", score: 42, totalSolved: 3, currentStreak: 0, rating: 1200, level: 1, rank: 7 });
  });
});
