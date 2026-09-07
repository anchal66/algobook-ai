/**
 * Mastery v2 (Module 04 §3.2). Composite 0–100 per topic **without a recency term**
 * (recency lives in the SRS schedule, fixing C11). Pure functions — no Firestore.
 */
import type { Difficulty, TopicSkill } from "@/lib/data/schema";

export const EXPECTED_TIME: Record<Difficulty, number> = { Easy: 600, Medium: 1200, Hard: 2400 };
export const EXPECTED_RUNS: Record<Difficulty, number> = { Easy: 3, Medium: 5, Hard: 8 };

export const WEAK_THRESHOLD = 50;
export const MASTERED_THRESHOLD = 80;
export const MASTERED_MIN_SOLVED = 3;

export const MASTERY_WEIGHTS = {
  accuracy: 35,
  firstTryRate: 15,
  breadth: 15,
  timeEfficiency: 15,
  independence: 10,
  volume: 10,
} as const;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function emptyTopicSkill(): TopicSkill {
  return {
    solved: 0, failed: 0, easy: 0, medium: 0, hard: 0, attempts: 0, firstTrySuccesses: 0,
    avgTimeSec: 0, timeEfficiency: 1, hintsUsed: 0, runCount: 0, editorialViews: 0, mastery: 0, lastSeen: null,
    srs: { interval: 1, ease: 2.5, nextReview: null, reps: 0 },
  };
}

export interface MasteryBreakdown {
  accuracy: number;
  firstTryRate: number;
  breadth: number;
  timeEfficiency: number;
  independence: number;
  volume: number;
  /** Weighted sum before the confidence multiplier (0–100). */
  raw: number;
  /** sqrt(min(1, solved / 3)) — one solve reads at most ~58%, three solves at full strength. */
  confidence: number;
  mastery: number;
}

/** Evidence multiplier: a single lucky AC cannot exceed 60 (spec §3.2), three solves count fully. */
export function confidenceFor(solved: number): number {
  return Math.sqrt(Math.min(1, Math.max(0, solved) / 3));
}

/**
 * accuracy        = solved / attempts                      (35)
 * firstTryRate    = firstTrySuccesses / max(1, solved)     (15)   ≤ 1 by construction
 * breadth         = (#difficulties solved > 0) / 3         (15)
 * timeEfficiency  = clamp(expected/actual, 0, 1.2) / 1.2   (15)   `skill.timeEfficiency` is the rolling ratio
 * independence    = 1 − clamp(avgHints·0.25 + editorialRate·0.4, 0, 1)   (10)
 * volume          = min(1, solved / 6)                     (10)
 * mastery         = raw × confidence(solved)                       a single solve can never read as "mastered"
 */
export function masteryBreakdown(skill: TopicSkill): MasteryBreakdown {
  const attempts = Math.max(skill.attempts, skill.solved + skill.failed);
  if (attempts === 0) return { accuracy: 0, firstTryRate: 0, breadth: 0, timeEfficiency: 0, independence: 1, volume: 0, raw: 0, confidence: 0, mastery: 0 };
  const accuracy = clamp(skill.solved / attempts, 0, 1);
  const firstTryRate = clamp(skill.firstTrySuccesses / Math.max(1, skill.solved), 0, 1);
  const breadth = [skill.easy > 0, skill.medium > 0, skill.hard > 0].filter(Boolean).length / 3;
  const timeEfficiency = clamp(skill.timeEfficiency ?? 1, 0, 1.2) / 1.2;
  const avgHints = skill.solved > 0 ? skill.hintsUsed / skill.solved : 0;
  const editorialRate = skill.solved > 0 ? (skill.editorialViews ?? 0) / skill.solved : 0;
  const independence = 1 - clamp(avgHints * 0.25 + editorialRate * 0.4, 0, 1);
  const volume = Math.min(1, skill.solved / 6);
  const W = MASTERY_WEIGHTS;
  const raw = clamp(
    accuracy * W.accuracy + firstTryRate * W.firstTryRate + breadth * W.breadth +
    timeEfficiency * W.timeEfficiency + independence * W.independence + volume * W.volume, 0, 100);
  const confidence = skill.solved > 0 ? confidenceFor(skill.solved) : 1; // failures-only: raw (small) stands as is
  const mastery = Math.round(clamp(raw * confidence, 0, 100));
  return { accuracy, firstTryRate, breadth, timeEfficiency, independence, volume, raw, confidence, mastery };
}

export function computeMastery(skill: TopicSkill): number {
  return masteryBreakdown(skill).mastery;
}

/**
 * Struggle adjustment (v1 rule kept): runCount vs expected runs for the difficulty.
 * index > 2 → ×0.85 (brute-forced it); index < 0.5 and first try → ×1.10 (clean solve).
 */
export function struggleAdjust(mastery: number, o: { accepted: boolean; runCount: number; difficulty: Difficulty; isFirstTry: boolean }): number {
  if (!o.accepted) return mastery;
  const expected = EXPECTED_RUNS[o.difficulty];
  const index = o.runCount > 0 ? o.runCount / expected : 1;
  if (index > 2) return Math.round(mastery * 0.85);
  if (index < 0.5 && o.isFirstTry) return Math.min(100, Math.round(mastery * 1.1));
  return mastery;
}

/** expected / actual, clamped to [0.3, 2] like v1 so one absurd timer value cannot dominate the rolling mean. */
export function timeEfficiencyFor(difficulty: Difficulty, timeSpentSec: number): number {
  if (timeSpentSec <= 0) return 1;
  return clamp(EXPECTED_TIME[difficulty] / timeSpentSec, 0.3, 2);
}

export interface SkillOutcome {
  accepted: boolean;
  difficulty: Difficulty;
  isFirstTry: boolean;
  hintsUsed: number;
  runCount: number;
  editorialViewed: boolean;
  timeSpentSec: number;
  /** First accepted submission for this problem (difficulty counters and breadth count first ACs only). */
  firstAccept: boolean;
}

/** Applies one submission to a topic skill (counters + mastery). SRS is applied separately by `srs.ts`. */
export function applyOutcomeToSkill(prev: TopicSkill, o: SkillOutcome): TopicSkill {
  const s: TopicSkill = { ...prev, srs: { ...prev.srs } };
  s.attempts += 1;
  s.hintsUsed += o.hintsUsed;
  s.runCount += o.runCount;
  if (o.accepted) {
    s.solved += 1;
    if (o.isFirstTry) s.firstTrySuccesses += 1;
    if (o.editorialViewed) s.editorialViews = (s.editorialViews ?? 0) + 1;
    if (o.firstAccept) {
      if (o.difficulty === "Easy") s.easy += 1;
      else if (o.difficulty === "Medium") s.medium += 1;
      else s.hard += 1;
    }
  } else {
    s.failed += 1;
  }
  const n = s.attempts;
  s.avgTimeSec = Math.round((prev.avgTimeSec * (n - 1) + o.timeSpentSec) / n);
  s.timeEfficiency = ((prev.timeEfficiency ?? 1) * (n - 1) + timeEfficiencyFor(o.difficulty, o.timeSpentSec)) / n;
  const b = masteryBreakdown(s);
  const adjusted = struggleAdjust(b.raw, { accepted: o.accepted, runCount: o.runCount, difficulty: o.difficulty, isFirstTry: o.isFirstTry });
  s.mastery = Math.round(clamp(adjusted * b.confidence, 0, 100));
  return s;
}

export function isWeak(skill: TopicSkill | undefined): boolean {
  return !!skill && skill.attempts > 0 && skill.mastery < WEAK_THRESHOLD;
}

export function isMastered(skill: TopicSkill | undefined): boolean {
  return !!skill && skill.mastery >= MASTERED_THRESHOLD && skill.solved >= MASTERED_MIN_SOLVED;
}

/** Topics with mastery < 50 among practiced topics, weakest first. */
export function weakTopics(topicSkills: Record<string, TopicSkill>): string[] {
  return Object.entries(topicSkills)
    .filter(([, s]) => isWeak(s))
    .sort((a, b) => a[1].mastery - b[1].mastery)
    .map(([t]) => t);
}

export function averageMastery(topicSkills: Record<string, TopicSkill>): number {
  const practiced = Object.values(topicSkills).filter((s) => s.attempts > 0);
  if (!practiced.length) return 0;
  return practiced.reduce((a, s) => a + s.mastery, 0) / practiced.length;
}
