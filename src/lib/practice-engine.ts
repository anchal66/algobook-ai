import type { UserProfile, PracticeState, GoalType, SessionHealth } from "@/types";
import { getWeakTopics } from "@/lib/user-profile";
import { getDueTopics } from "@/lib/spaced-repetition";

/**
 * Determines the user's practice state based on their profile data.
 * State machine transitions:
 *
 *   warm-up → learning → strengthening → maintenance
 *                ↑            ↓
 *              revision ←──────
 *
 *   interview-prep is a parallel track entered via goalType
 *
 * A user can be in interview-prep but still need warm-up after a break.
 */

export function computePracticeState(profile: UserProfile): PracticeState {
  const total = profile.totalSolved + profile.totalFailed;
  const daysSinceActive = getDaysSinceActive(profile);

  // Returning after a long break: force warm-up regardless of goal
  if (daysSinceActive >= 14 && total > 0 && !profile.calibrationComplete) {
    return "warm-up";
  }

  // Brand new user: warm-up for beginners, learning for others
  if (total === 0) {
    if (profile.experienceLevel === "beginner") return "warm-up";
    return "learning";
  }

  // Goal-driven override
  if (profile.goalType === "interview-prep") {
    return "interview-prep";
  }

  // Check for due/weak topics that need revision (spaced repetition replaces flat stale check)
  const dueForReview = getDueTopics(profile);
  const weak = getWeakTopics(profile);
  if (dueForReview.length >= 3 || (dueForReview.length >= 1 && weak.length >= 2)) {
    return "revision";
  }

  // Progress-based states
  const passRate = total > 0 ? profile.totalSolved / total : 0;

  if (total < 10) {
    return "learning";
  }

  if (weak.length > 0 || passRate < 0.6) {
    return "strengthening";
  }

  return "maintenance";
}

export function getDaysSinceActive(profile: UserProfile): number {
  if (!profile.lastActiveDate) return Infinity;
  const last = new Date(profile.lastActiveDate);
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * For returning users, determines what the calibration sequence should be:
 *   Step 0: easy warm-up on a familiar topic
 *   Step 1: medium question on a topic they've solved before
 *   Step 2: weak-topic recap
 *   Step 3: calibration complete — resume normal recommendations
 */
export interface CalibrationSpec {
  difficulty: "Easy" | "Medium" | "Hard";
  topicHint: string;
  reason: string;
}

export function getCalibrationSpec(
  profile: UserProfile,
  step: number
): CalibrationSpec | null {
  if (step >= 3 || profile.calibrationComplete) return null;

  const solvedTopics = Object.entries(profile.topicSkills || {})
    .filter(([, s]) => s.solved > 0)
    .map(([t]) => t);
  const weak = getWeakTopics(profile);

  if (step === 0) {
    const familiar = solvedTopics[0] || "array";
    return {
      difficulty: "Easy",
      topicHint: familiar,
      reason: `Welcome back! Here's a warm-up on "${familiar}" to ease you in.`,
    };
  }

  if (step === 1) {
    const familiar = solvedTopics.length > 1 ? solvedTopics[1] : solvedTopics[0] || "string";
    return {
      difficulty: "Medium",
      topicHint: familiar,
      reason: `Let's check your comfort level — a medium "${familiar}" problem you've seen before.`,
    };
  }

  // step === 2
  const recapTopic = weak[0] || solvedTopics[solvedTopics.length - 1] || "array";
  return {
    difficulty: "Easy",
    topicHint: recapTopic,
    reason: `Quick recap on "${recapTopic}" — your weakest area. Nail this and we'll move on!`,
  };
}

/**
 * Returns what the state means for recommendation behavior.
 */
export interface StateGuidance {
  difficultyBias: "Easy" | "Medium" | "Hard" | null;
  topicStrategy: "weak-first" | "new-topics" | "mixed" | "familiar" | "interview-patterns";
  description: string;
}

export function getStateGuidance(
  state: PracticeState,
  goal: GoalType
): StateGuidance {
  switch (state) {
    case "warm-up":
      return {
        difficultyBias: "Easy",
        topicStrategy: "familiar",
        description: "Warm-up phase: easy questions on familiar topics to rebuild confidence",
      };
    case "learning":
      return {
        difficultyBias: null,
        topicStrategy: "new-topics",
        description: "Learning phase: introduce new topics at an appropriate difficulty",
      };
    case "strengthening":
      return {
        difficultyBias: null,
        topicStrategy: "weak-first",
        description: "Strengthening phase: focus on weak topics to improve mastery",
      };
    case "revision":
      return {
        difficultyBias: "Easy",
        topicStrategy: "familiar",
        description: "Revision phase: review stale topics that haven't been practiced recently",
      };
    case "interview-prep":
      return {
        difficultyBias: "Medium",
        topicStrategy: "interview-patterns",
        description:
          goal === "interview-prep"
            ? "Interview prep: medium-hard problems covering common interview patterns (sliding window, two pointers, BFS/DFS, DP)"
            : "Interview prep: building toward interview-level difficulty",
      };
    case "maintenance":
      return {
        difficultyBias: null,
        topicStrategy: "mixed",
        description: "Maintenance phase: balanced mix of topics and difficulties to stay sharp",
      };
  }
}

// ── SESSION GUIDANCE ──
// Adjusts recommendations based on session fatigue

export interface SessionGuidance {
  difficultyAdjust: -1 | 0 | 1;
  shouldSuggestBreak: boolean;
  message: string;
}

export function getSessionGuidance(health: SessionHealth): SessionGuidance {
  if (health.score < 30) {
    return {
      difficultyAdjust: -1,
      shouldSuggestBreak: true,
      message: "Your session performance is declining. Consider taking a break to reset.",
    };
  }
  if (health.score < 60) {
    return {
      difficultyAdjust: -1,
      shouldSuggestBreak: false,
      message: "Dropping difficulty — you've been at it for a while and efficiency is decreasing.",
    };
  }
  if (health.score >= 90 && health.trend === "improving" && health.problemsSolved >= 3) {
    return {
      difficultyAdjust: 1,
      shouldSuggestBreak: false,
      message: "You're on a roll! Bumping up difficulty to challenge you.",
    };
  }
  return {
    difficultyAdjust: 0,
    shouldSuggestBreak: false,
    message: "",
  };
}

// ── STATE PROGRESS ──
// Tells user what they need to do to exit their current state

export function getStateProgress(profile: UserProfile): string {
  const state = computePracticeState(profile);
  const total = profile.totalSolved + profile.totalFailed;
  const weak = getWeakTopics(profile);
  const passRate = total > 0 ? profile.totalSolved / total : 0;

  switch (state) {
    case "warm-up":
      return profile.calibrationComplete
        ? "Complete a few problems to exit warm-up."
        : `Complete ${3 - profile.calibrationStep} more calibration problem(s) to finish warm-up.`;
    case "learning":
      return `Solve ${Math.max(0, 10 - total)} more problems to advance to strengthening.`;
    case "strengthening":
      if (weak.length > 0) {
        return `Improve mastery in ${weak.slice(0, 3).join(", ")} to 50%+ to advance.`;
      }
      return `Raise your pass rate above 60% (currently ${Math.round(passRate * 100)}%).`;
    case "revision": {
      const due = getDueTopics(profile);
      return `Review ${due.length} overdue topic(s): ${due.slice(0, 3).join(", ")}${due.length > 3 ? "..." : ""}.`;
    }
    case "interview-prep":
      return "Practicing interview patterns. Switch goal to exit this mode.";
    case "maintenance":
      return "You're in maintenance — keep solving to stay sharp!";
  }
}
