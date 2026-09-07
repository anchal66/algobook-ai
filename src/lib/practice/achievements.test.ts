import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, catalogForClient, evaluateAchievements, getAchievement, type AchievementContext } from "./achievements";
import { makeUser, practiced } from "./_fixtures";

function ctx(over: Omit<Partial<AchievementContext>, "stats" | "submission"> & { stats?: Partial<AchievementContext["stats"]>; submission?: Partial<AchievementContext["submission"]> } = {}): AchievementContext {
  const u = makeUser({ stats: over.stats });
  return {
    stats: u.stats,
    topicSkills: over.topicSkills ?? {},
    submission: { accepted: true, firstAccept: true, difficulty: "Easy", language: "java", timeSpentSec: 300, hintsUsed: 0, isFirstTry: true, localHour: 12, ...(over.submission ?? {}) },
    templateCompleted: over.templateCompleted ?? null,
  };
}

describe("achievements (P-09)", () => {
  it("catalog has stable unique ids and the required entries", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["first_ac", "streak_7", "streak_30", "streak_100", "easy_10", "medium_25", "hard_10", "night_owl", "speedrunner", "no_hints_20", "polyglot", "rating_1500", "rating_1800", "daily_10", "topic_master_graph", "topic_master_dynamic_programming", "template_complete_google"]) {
      expect(ids).toContain(id);
    }
    expect(catalogForClient()[0]).not.toHaveProperty("condition");
    expect(getAchievement("first_ac")?.name).toBe("First Blood");
  });

  it("first AC unlocks first_ac only once", () => {
    expect(evaluateAchievements(ctx({ stats: { totalSolved: 1 } }), [])).toEqual(["first_ac"]);
    expect(evaluateAchievements(ctx({ stats: { totalSolved: 1 } }), ["first_ac"])).toEqual([]);
  });

  it("streak, volume, rating and daily thresholds", () => {
    const out = evaluateAchievements(ctx({ stats: { totalSolved: 40, currentStreak: 30, easy: 10, medium: 25, hard: 10, rating: 1820, dailySolved: 10, noHintSolves: 20, languagesAccepted: ["java", "python"] } }), []);
    for (const id of ["streak_7", "streak_30", "easy_10", "medium_25", "hard_10", "rating_1500", "rating_1800", "daily_10", "no_hints_20", "polyglot"]) expect(out).toContain(id);
    expect(out).not.toContain("streak_100");
  });

  it("night owl and speedrunner depend on the submission", () => {
    expect(evaluateAchievements(ctx({ submission: { localHour: 2 } }), ["first_ac"])).toContain("night_owl");
    expect(evaluateAchievements(ctx({ submission: { localHour: 5 } }), ["first_ac"])).not.toContain("night_owl");
    expect(evaluateAchievements(ctx({ submission: { difficulty: "Medium", timeSpentSec: 200 } }), ["first_ac"])).toContain("speedrunner");
    expect(evaluateAchievements(ctx({ submission: { difficulty: "Medium", timeSpentSec: 400 } }), ["first_ac"])).not.toContain("speedrunner");
  });

  it("topic master needs mastery ≥ 80; template completion needs the company", () => {
    expect(evaluateAchievements(ctx({ topicSkills: { graph: practiced(85, { solved: 5 }) } }), ["first_ac"])).toContain("topic_master_graph");
    expect(evaluateAchievements(ctx({ topicSkills: { graph: practiced(79, { solved: 5 }) } }), ["first_ac"])).not.toContain("topic_master_graph");
    expect(evaluateAchievements(ctx({ templateCompleted: "uber" }), ["first_ac"])).toContain("template_complete_uber");
  });
});
