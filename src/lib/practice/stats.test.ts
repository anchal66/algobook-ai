import { describe, expect, it } from "vitest";
import { applyStreak, applySubmissionToStats, levelFor, scoreFor, streakStatus, xpFor, type SubmissionOutcome } from "./stats";
import { NOW, TODAY, practiced, userDoc } from "./_fixtures";

function outcome(over: Partial<SubmissionOutcome> = {}): SubmissionOutcome {
  return {
    submissionId: "sub1", problemId: "p1", accepted: true, firstAccept: true, alreadyAccepted: false, attemptNumber: 1,
    difficulty: "Easy", tags: ["array", "hash map"], language: "java", timeSpentSec: 300, hintsUsed: 0, runCount: 1,
    editorialViewed: false, problemRating: 1100, isDailyChallenge: false, now: NOW, ...over,
  };
}

describe("XP / level / score formulas (P-10)", () => {
  it("first AC: 10/25/50 + 2 per attempt + 5 clean bonus; −30% with editorial", () => {
    expect(xpFor({ accepted: true, firstAccept: true, difficulty: "Easy", isFirstTry: true, hintsUsed: 0, editorialViewed: false, isDailyChallenge: false })).toBe(17);
    expect(xpFor({ accepted: true, firstAccept: true, difficulty: "Medium", isFirstTry: false, hintsUsed: 1, editorialViewed: false, isDailyChallenge: false })).toBe(27);
    expect(xpFor({ accepted: true, firstAccept: true, difficulty: "Hard", isFirstTry: true, hintsUsed: 0, editorialViewed: true, isDailyChallenge: false })).toBe(40);
    expect(xpFor({ accepted: false, firstAccept: false, difficulty: "Hard", isFirstTry: false, hintsUsed: 0, editorialViewed: false, isDailyChallenge: false })).toBe(2);
    expect(xpFor({ accepted: true, firstAccept: false, difficulty: "Easy", isFirstTry: false, hintsUsed: 0, editorialViewed: false, isDailyChallenge: true })).toBe(22);
  });
  it("level = 1 + floor(sqrt(xp/50))", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(49)).toBe(1);
    expect(levelFor(50)).toBe(2);
    expect(levelFor(450)).toBe(4);
  });
  it("score weights streak 2.5× volume (per Working.md)", () => {
    expect(scoreFor({ easy: 1, medium: 1, hard: 1, currentStreak: 2, longestStreak: 3, rating: 1200 }, 50)).toBe(12 + 10 + 25 + 6 + 24);
  });
});

describe("streaks and freezes (P-08)", () => {
  it("consecutive day extends; same day no-op; gap without freeze resets", () => {
    expect(applyStreak({ currentStreak: 3, longestStreak: 5, lastActiveDate: "2026-09-07", streakFreezes: 0 }, TODAY)).toMatchObject({ currentStreak: 4, longestStreak: 5 });
    expect(applyStreak({ currentStreak: 3, longestStreak: 5, lastActiveDate: TODAY, streakFreezes: 0 }, TODAY)).toMatchObject({ currentStreak: 3 });
    expect(applyStreak({ currentStreak: 3, longestStreak: 5, lastActiveDate: "2026-09-05", streakFreezes: 0 }, TODAY)).toMatchObject({ currentStreak: 1 });
    expect(applyStreak({ currentStreak: 0, longestStreak: 0, lastActiveDate: "", streakFreezes: 0 }, TODAY)).toMatchObject({ currentStreak: 1, longestStreak: 1 });
  });
  it("a missed day consumes a freeze and preserves the streak", () => {
    const r = applyStreak({ currentStreak: 9, longestStreak: 9, lastActiveDate: "2026-09-06", streakFreezes: 1 }, TODAY);
    expect(r).toMatchObject({ currentStreak: 10, streakFreezes: 0, freezesUsed: 1 });
    const twoMissed = applyStreak({ currentStreak: 9, longestStreak: 9, lastActiveDate: "2026-09-05", streakFreezes: 1 }, TODAY);
    expect(twoMissed.currentStreak).toBe(1);
  });
  it("earns a freeze every 7 days, max 2", () => {
    expect(applyStreak({ currentStreak: 6, longestStreak: 6, lastActiveDate: "2026-09-07", streakFreezes: 0 }, TODAY)).toMatchObject({ currentStreak: 7, streakFreezes: 1, freezeEarned: true });
    expect(applyStreak({ currentStreak: 13, longestStreak: 13, lastActiveDate: "2026-09-07", streakFreezes: 2 }, TODAY)).toMatchObject({ currentStreak: 14, streakFreezes: 2, freezeEarned: false });
  });
  it("streakStatus for the top bar", () => {
    expect(streakStatus({ currentStreak: 3, lastActiveDate: TODAY, streakFreezes: 0 }, TODAY)).toMatchObject({ active: true, atRisk: false });
    expect(streakStatus({ currentStreak: 3, lastActiveDate: "2026-09-07", streakFreezes: 0 }, TODAY)).toMatchObject({ active: true, atRisk: true });
    expect(streakStatus({ currentStreak: 3, lastActiveDate: "2026-09-06", streakFreezes: 1 }, TODAY)).toMatchObject({ active: true, coveredByFreeze: true });
    expect(streakStatus({ currentStreak: 3, lastActiveDate: "2026-09-06", streakFreezes: 0 }, TODAY).active).toBe(false);
  });
});

describe("applySubmissionToStats (P-07)", () => {
  it("first AC updates counters, skills, srs, rating, xp, level, score and unlocks first_ac", () => {
    const r = applySubmissionToStats(userDoc(), [], outcome());
    expect(r.applied).toBe(true);
    expect(r.stats.totalSolved).toBe(1);
    expect(r.stats.easy).toBe(1);
    expect(r.stats.currentStreak).toBe(1);
    expect(r.stats.lastActiveDate).toBe(TODAY);
    expect(r.xpEarned).toBe(17);
    expect(r.stats.xp).toBe(17);
    expect(r.stats.level).toBe(1);
    expect(r.stats.noHintSolves).toBe(1);
    expect(r.stats.languagesAccepted).toEqual(["java"]);
    expect(r.rating?.before).toBe(1200);
    expect(r.rating?.user).toBeGreaterThan(1200);
    expect(r.rating?.problem).toBeLessThan(1100);
    expect(r.stats.ratedSolves).toBe(1);
    expect(r.stats.score).toBeGreaterThan(0);
    expect(Object.keys(r.topicSkills).sort()).toEqual(["array", "hash map"]);
    expect(r.topicSkills.array.solved).toBe(1);
    expect(r.topicSkills.array.srs).toMatchObject({ interval: 1, reps: 1, nextReview: "2026-09-09" });
    expect(r.topicSkills.array.mastery).toBeGreaterThan(0);
    expect(r.topicSkills.array.mastery).toBeLessThanOrEqual(60);
    expect(r.newlyUnlocked).toEqual(["first_ac"]);
    expect(r.updates.lastAppliedSubmissionId).toBe("sub1");
    expect(r.practiceState).toBe("learning");
  });

  it("is idempotent per submission id", () => {
    const first = applySubmissionToStats(userDoc(), [], outcome());
    const replay = applySubmissionToStats({ ...userDoc(), ...first.updates }, ["first_ac"], outcome());
    expect(replay.applied).toBe(false);
    expect(replay.xpEarned).toBe(0);
    expect(replay.newlyUnlocked).toEqual([]);
    expect(replay.updates).toEqual({});
    expect(replay.stats.totalSolved).toBe(1);
  });

  it("a failed first attempt is unrated; the third failure rates as failed-out", () => {
    const fail1 = applySubmissionToStats(userDoc(), [], outcome({ accepted: false, firstAccept: false, attemptNumber: 1 }));
    expect(fail1.rating).toBeNull();
    expect(fail1.stats.totalFailed).toBe(1);
    expect(fail1.xpEarned).toBe(2);
    expect(fail1.topicSkills.array.srs.interval).toBe(1);
    const fail3 = applySubmissionToStats(userDoc(), [], outcome({ accepted: false, firstAccept: false, attemptNumber: 3, submissionId: "s3" }));
    expect(fail3.rating?.delta).toBeLessThan(0);
  });

  it("a later AC on an already-accepted problem adds no difficulty counter and no rating change", () => {
    const r = applySubmissionToStats(userDoc({ stats: { totalSolved: 1, easy: 1, rating: 1216, ratedSolves: 1 } }), ["first_ac"], outcome({ firstAccept: false, alreadyAccepted: true, attemptNumber: 2, submissionId: "s2" }));
    expect(r.stats.easy).toBe(1);
    expect(r.stats.totalSolved).toBe(2);
    expect(r.rating).toBeNull();
    expect(r.xpEarned).toBe(2);
  });

  it("daily challenge adds +20 xp and counts toward daily_10", () => {
    const r = applySubmissionToStats(userDoc(), [], outcome({ isDailyChallenge: true }));
    expect(r.xpEarned).toBe(37);
    expect(r.stats.dailySolved).toBe(1);
  });

  it("advances calibration on accepted solves and completes at step 3", () => {
    const doc = userDoc({ calibration: { complete: false, step: 2 }, stats: { totalSolved: 12, lastActiveDate: "2026-09-07" } });
    const r = applySubmissionToStats(doc, [], outcome());
    expect(r.calibration).toEqual({ complete: true, step: 3 });
    expect(r.practiceState).not.toBe("warm-up");
  });

  it("a freeze covers a missed day inside the engine", () => {
    const doc = userDoc({ stats: { currentStreak: 7, longestStreak: 7, lastActiveDate: "2026-09-06", streakFreezes: 1 } });
    const r = applySubmissionToStats(doc, [], outcome());
    expect(r.stats.currentStreak).toBe(8);
    expect(r.stats.streakFreezes).toBe(0);
    expect(r.streakFreezeUsed).toBe(1);
  });

  it("editorial view lowers xp and SRS quality", () => {
    const r = applySubmissionToStats(userDoc(), [], outcome({ editorialViewed: true }));
    expect(r.xpEarned).toBe(12);
    expect(r.topicSkills.array.editorialViews).toBe(1);
    expect(r.topicSkills.array.srs.reps).toBe(0); // quality 1 → reset
  });

  it("unlocks topic_master when mastery crosses 80", () => {
    const doc = userDoc({ stats: { totalSolved: 4, easy: 2, medium: 2 }, topicSkills: { graph: practiced(78, { solved: 4, attempts: 4, failed: 0, easy: 2, medium: 2, firstTrySuccesses: 4 }) } });
    const r = applySubmissionToStats(doc, ["first_ac"], outcome({ tags: ["graph"], difficulty: "Hard", timeSpentSec: 600 }));
    expect(r.topicSkills.graph.mastery).toBeGreaterThanOrEqual(80);
    expect(r.newlyUnlocked).toContain("topic_master_graph");
  });

  it("switches K to 16 after 30 rated solves", () => {
    const r = applySubmissionToStats(userDoc({ stats: { ratedSolves: 30 } }), ["first_ac"], outcome({ problemRating: 1200 }));
    expect(r.rating?.k).toBe(16);
  });
});
