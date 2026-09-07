import { describe, expect, it } from "vitest";
import { DEFAULT_SRS, addDays, daysBetween, getDueTopics, normalizeSrs, reviewQuality, topicUrgency, updateSrs } from "./srs";
import { skill } from "./_fixtures";

describe("SRS v2 (P-03)", () => {
  it("three clean solves on consecutive days grow 1 → 3 → 8 (ease 2.5 → 2.6)", () => {
    let s = normalizeSrs(undefined, "2026-09-01");
    s = updateSrs(s, 3, "2026-09-01");
    expect(s.interval).toBe(1);
    expect(s.ease).toBe(2.6);
    expect(s.nextReview).toBe("2026-09-02");
    s = updateSrs(s, 3, "2026-09-02");
    expect(s.interval).toBe(3);
    expect(s.nextReview).toBe("2026-09-05");
    s = updateSrs(s, 3, "2026-09-05");
    expect(s.interval).toBe(8); // round(3 × 2.6)
    expect(s.reps).toBe(3);
    expect(s.nextReview).toBe("2026-09-13");
  });

  it("v1 bug fixed: an interval of 1 can grow", () => {
    const s = updateSrs({ interval: 1, ease: 2.5, nextReview: "2026-09-01", reps: 1 }, 2, "2026-09-01");
    expect(s.interval).toBe(3);
  });

  it("a failure resets to 1 day and drops ease (floored at 1.3)", () => {
    const s = updateSrs({ interval: 20, ease: 1.4, nextReview: null, reps: 5 }, 0, "2026-09-08");
    expect(s).toEqual({ interval: 1, ease: 1.3, reps: 0, nextReview: "2026-09-09" });
  });

  it("heavy help (quality 1) also resets", () => {
    const s = updateSrs({ interval: 8, ease: 2.6, nextReview: null, reps: 3 }, 1, "2026-09-08");
    expect(s.interval).toBe(1);
    expect(s.ease).toBe(2.4);
  });

  it("moderate help grows slower than a clean solve and intervals cap at 180", () => {
    const clean = updateSrs({ interval: 30, ease: 2.5, nextReview: null, reps: 5 }, 3, "2026-09-08");
    const moderate = updateSrs({ interval: 30, ease: 2.5, nextReview: null, reps: 5 }, 2, "2026-09-08");
    expect(clean.ease).toBeGreaterThan(moderate.ease);
    const capped = updateSrs({ interval: 150, ease: 2.5, nextReview: null, reps: 9 }, 3, "2026-09-08");
    expect(capped.interval).toBe(180);
  });

  it("review quality mapping", () => {
    expect(reviewQuality({ accepted: false, hintsUsed: 0, isFirstTry: true, timeEfficiency: 1 })).toBe(0);
    expect(reviewQuality({ accepted: true, hintsUsed: 3, isFirstTry: true, timeEfficiency: 1 })).toBe(1);
    expect(reviewQuality({ accepted: true, hintsUsed: 0, isFirstTry: true, timeEfficiency: 0.3 })).toBe(1);
    expect(reviewQuality({ accepted: true, hintsUsed: 0, isFirstTry: true, timeEfficiency: 1, editorialViewed: true })).toBe(1);
    expect(reviewQuality({ accepted: true, hintsUsed: 1, isFirstTry: true, timeEfficiency: 1 })).toBe(2);
    expect(reviewQuality({ accepted: true, hintsUsed: 0, isFirstTry: false, timeEfficiency: 1 })).toBe(2);
    expect(reviewQuality({ accepted: true, hintsUsed: 0, isFirstTry: true, timeEfficiency: 1 })).toBe(3);
  });

  it("legacy entries without srs are due today", () => {
    expect(normalizeSrs(undefined, "2026-09-08")).toEqual({ ...DEFAULT_SRS, nextReview: "2026-09-08" });
    const due = getDueTopics({ arr: skill({ solved: 1, srs: undefined as never }) }, "2026-09-08");
    expect(due.map((d) => d.topic)).toEqual(["arr"]);
  });

  it("due topics: unsolved topics are skipped, most urgent first, urgency saturates at 14 days overdue", () => {
    const skills = {
      fresh: skill({ solved: 2, mastery: 80, srs: { interval: 8, ease: 2.5, nextReview: "2026-09-20", reps: 3 } }),
      due1: skill({ solved: 2, mastery: 80, srs: { interval: 8, ease: 2.5, nextReview: "2026-09-07", reps: 3 } }),
      due2: skill({ solved: 2, mastery: 20, srs: { interval: 8, ease: 2.5, nextReview: "2026-08-01", reps: 3 } }),
      never: skill({ solved: 0, srs: { interval: 1, ease: 2.5, nextReview: "2026-01-01", reps: 0 } }),
    };
    const due = getDueTopics(skills, "2026-09-08");
    expect(due.map((d) => d.topic)).toEqual(["due2", "due1"]);
    expect(topicUrgency(skills.due2, "2026-09-08")).toBeCloseTo(0.6 + 0.4 * 0.8, 5);
    expect(due[1].overdueDays).toBe(1);
  });

  it("an idle month makes a topic due without touching mastery", () => {
    const s = skill({ solved: 3, mastery: 77, srs: { interval: 8, ease: 2.6, nextReview: "2026-08-10", reps: 3 } });
    const due = getDueTopics({ t: s }, "2026-09-09");
    expect(due[0].topic).toBe("t");
    expect(s.mastery).toBe(77);
  });

  it("date helpers", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-09-01", "2026-09-08")).toBe(7);
  });
});
