/**
 * Practice state machine (Module 04 §3.4) — v1 port with three fixes:
 *   • the returning-user threshold reads `stats.lastActiveDate`,
 *   • "learning" exits at 10 **solved** (not attempts),
 *   • interview-prep no longer overrides revision when ≥ 5 topics are due.
 */
import type { Difficulty, GoalType, PracticeState, TopicSkill, User } from "@/lib/data/schema";
import { weakTopics } from "@/lib/practice/mastery";
import { daysBetween, getDueTopics } from "@/lib/practice/srs";

export const RETURNING_AFTER_DAYS = 14;
export const LEARNING_EXIT_SOLVED = 10;
export const CALIBRATION_STEPS = 3;

/** The slice of `users/{uid}` the state machine reads (so tests can pass partial docs). */
export type UserLike = Pick<User, "stats" | "topicSkills" | "experienceLevel" | "goalType" | "calibration">;

export function daysSinceActive(user: UserLike, today: string): number {
  const last = user.stats.lastActiveDate;
  if (!last) return Infinity;
  return Math.max(0, daysBetween(last, today));
}

export function isReturningUser(user: UserLike, today: string): boolean {
  const total = user.stats.totalSolved + user.stats.totalFailed;
  return total > 0 && daysSinceActive(user, today) >= RETURNING_AFTER_DAYS;
}

/** True when a returning user should (re)enter the 3-step calibration. */
export function shouldStartCalibration(user: UserLike, today: string): boolean {
  return user.calibration.complete && isReturningUser(user, today);
}

export function computePracticeState(user: UserLike, today: string): PracticeState {
  const total = user.stats.totalSolved + user.stats.totalFailed;
  if (!user.calibration.complete) return "warm-up";
  if (isReturningUser(user, today)) return "warm-up";
  if (total === 0) return user.experienceLevel === "beginner" ? "warm-up" : "learning";

  const due = getDueTopics(user.topicSkills, today);
  const weak = weakTopics(user.topicSkills);
  if (user.goalType === "interview-prep") return due.length >= 5 ? "revision" : "interview-prep";
  if (due.length >= 3 || (due.length >= 1 && weak.length >= 2)) return "revision";
  if (user.stats.totalSolved < LEARNING_EXIT_SOLVED) return "learning";
  const passRate = user.stats.totalSolved / total;
  if (weak.length > 0 || passRate < 0.6) return "strengthening";
  return "maintenance";
}

export type TopicStrategy = "weak-first" | "new-topics" | "mixed" | "familiar" | "interview-patterns";

export interface StateGuidance {
  difficultyBias: Difficulty | null;
  topicStrategy: TopicStrategy;
  description: string;
}

export function getStateGuidance(state: PracticeState, goal: GoalType): StateGuidance {
  switch (state) {
    case "warm-up":
      return { difficultyBias: "Easy", topicStrategy: "familiar", description: "Warm-up: easy problems on familiar topics to rebuild confidence" };
    case "learning":
      return { difficultyBias: null, topicStrategy: "new-topics", description: "Learning: introduce new topics at an appropriate difficulty" };
    case "strengthening":
      return { difficultyBias: null, topicStrategy: "weak-first", description: "Strengthening: focus on weak topics to raise mastery" };
    case "revision":
      return { difficultyBias: "Easy", topicStrategy: "familiar", description: "Revision: spaced review of topics that are due" };
    case "interview-prep":
      return {
        difficultyBias: "Medium", topicStrategy: "interview-patterns",
        description: goal === "interview-prep"
          ? "Interview prep: medium-hard problems across common interview patterns"
          : "Interview prep: building toward interview-level difficulty",
      };
    case "maintenance":
      return { difficultyBias: null, topicStrategy: "mixed", description: "Maintenance: balanced mix of topics and difficulties to stay sharp" };
  }
}

export interface CalibrationSpec { difficulty: Difficulty; topic: string; reason: string }

/** Step 0: easy familiar · step 1: medium familiar · step 2: easy weakest · step ≥ 3: done. */
export function getCalibrationSpec(user: UserLike, step: number): CalibrationSpec | null {
  if (step >= CALIBRATION_STEPS) return null;
  const solved = Object.entries(user.topicSkills).filter(([, s]) => s.solved > 0).sort((a, b) => b[1].mastery - a[1].mastery).map(([t]) => t);
  const weak = weakTopics(user.topicSkills);
  if (step === 0) {
    const t = solved[0] ?? "array";
    return { difficulty: "Easy", topic: t, reason: `Welcome back! A warm-up on "${t}" to ease you in.` };
  }
  if (step === 1) {
    const t = solved[1] ?? solved[0] ?? "string";
    return { difficulty: "Medium", topic: t, reason: `Checking your comfort level — a medium "${t}" problem on a topic you know.` };
  }
  const t = weak[0] ?? solved[solved.length - 1] ?? "array";
  return { difficulty: "Easy", topic: t, reason: `Quick recap on "${t}" — your weakest area. Nail this and we resume normal practice.` };
}

/** Human-readable "what gets you out of this state". */
export function getStateProgress(user: UserLike, today: string): string {
  const state = computePracticeState(user, today);
  const total = user.stats.totalSolved + user.stats.totalFailed;
  const weak = weakTopics(user.topicSkills);
  const passRate = total > 0 ? user.stats.totalSolved / total : 0;
  switch (state) {
    case "warm-up":
      return user.calibration.complete
        ? "Solve a couple of problems to leave warm-up."
        : `Complete ${CALIBRATION_STEPS - user.calibration.step} more calibration problem(s) to finish warm-up.`;
    case "learning":
      return `Solve ${Math.max(0, LEARNING_EXIT_SOLVED - user.stats.totalSolved)} more problem(s) to advance to strengthening.`;
    case "strengthening":
      return weak.length
        ? `Raise ${weak.slice(0, 3).join(", ")} to 50%+ mastery to advance.`
        : `Raise your pass rate above 60% (currently ${Math.round(passRate * 100)}%).`;
    case "revision": {
      const due = getDueTopics(user.topicSkills, today);
      return `Review ${due.length} due topic(s): ${due.slice(0, 3).map((d) => d.topic).join(", ")}${due.length > 3 ? "…" : ""}.`;
    }
    case "interview-prep":
      return "Practising interview patterns. Change your goal to leave this mode.";
    case "maintenance":
      return "You're in maintenance — keep solving to stay sharp!";
  }
}

export interface SessionGuidance { difficultyAdjust: -1 | 0 | 1; shouldSuggestBreak: boolean; message: string }

/**
 * Server-side reading of the client's session health score (0–100, `session-tracker.ts`).
 * < 30 → drop a level and suggest a break · < 60 → drop a level · ≥ 90 → bump a level.
 */
export function getSessionGuidance(score: number | undefined | null): SessionGuidance {
  if (score === undefined || score === null || Number.isNaN(score)) return { difficultyAdjust: 0, shouldSuggestBreak: false, message: "" };
  const s = Math.min(100, Math.max(0, score));
  if (s < 30) return { difficultyAdjust: -1, shouldSuggestBreak: true, message: "Your session performance is declining — consider a 10–15 minute break." };
  if (s < 60) return { difficultyAdjust: -1, shouldSuggestBreak: false, message: "Dropping difficulty a notch — efficiency is dipping this session." };
  if (s >= 90) return { difficultyAdjust: 1, shouldSuggestBreak: false, message: "You're on a roll — bumping difficulty up a notch." };
  return { difficultyAdjust: 0, shouldSuggestBreak: false, message: "" };
}

/** Topics the user has solved at least once, best mastery first. */
export function familiarTopics(topicSkills: Record<string, TopicSkill>): string[] {
  return Object.entries(topicSkills).filter(([, s]) => s.solved > 0).sort((a, b) => b[1].mastery - a[1].mastery).map(([t]) => t);
}
