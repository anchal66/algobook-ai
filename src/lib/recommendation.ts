import type { UserProfile, RecommendationReason } from "@/types";
import {
  getWeakTopics,
  getStaleTopics,
  getRecommendedDifficulty,
} from "@/lib/user-profile";
import {
  computePracticeState,
  getCalibrationSpec,
  getStateGuidance,
  getDaysSinceActive,
} from "@/lib/practice-engine";

export interface Recommendation {
  difficulty: "Easy" | "Medium" | "Hard";
  suggestedTopics: string[];
  avoidTopics: string[];
  reason: RecommendationReason;
  promptOverride?: string;
  isCalibration: boolean;
}

interface ExistingQuestion {
  title: string;
  tags: string[];
  difficulty: string;
}

/**
 * Core recommendation engine.
 * Decides difficulty, topic, and reason for the next question.
 */
export function recommend(
  profile: UserProfile,
  existingQuestions: ExistingQuestion[],
  userPrompt?: string,
): Recommendation {
  const state = computePracticeState(profile);
  const daysSince = getDaysSinceActive(profile);

  // ── RETURNING USER CALIBRATION ──
  if (
    !profile.calibrationComplete &&
    daysSince >= 14 &&
    profile.calibrationStep < 3
  ) {
    const spec = getCalibrationSpec(profile, profile.calibrationStep);
    if (spec) {
      return {
        difficulty: spec.difficulty,
        suggestedTopics: [spec.topicHint],
        avoidTopics: [],
        reason: {
          short: `Calibration step ${profile.calibrationStep + 1}/3`,
          detail: spec.reason,
        },
        promptOverride: `Give me a ${spec.difficulty.toLowerCase()} question on ${spec.topicHint}.`,
        isCalibration: true,
      };
    }
  }

  // ── COLLECT SIGNALS ──
  const weak = getWeakTopics(profile);
  const stale = getStaleTopics(profile);
  const baseDifficulty = getRecommendedDifficulty(profile);
  const guidance = getStateGuidance(state, profile.goalType);

  const recentTags = getRecentTags(existingQuestions, 3);
  const allPracticedTopics = Object.keys(profile.topicSkills || {});
  const unpracticed = findUnpracticedTopics(allPracticedTopics);

  // ── BUILD RECOMMENDATION ──

  let difficulty = guidance.difficultyBias || baseDifficulty;
  let suggestedTopics: string[] = [];
  let reason: RecommendationReason;

  switch (guidance.topicStrategy) {
    case "weak-first": {
      suggestedTopics = weak.slice(0, 3);
      if (suggestedTopics.length === 0) suggestedTopics = pickRandom(allPracticedTopics, 2);
      const weakTopic = suggestedTopics[0] || "general";
      reason = {
        short: `Weak topic: ${weakTopic}`,
        detail: `Picked because your mastery in "${weakTopic}" is below 50%. Focused practice here will strengthen your skills.`,
      };
      break;
    }

    case "new-topics": {
      suggestedTopics = unpracticed.length > 0
        ? pickRandom(unpracticed, 2)
        : pickRandom(CORE_TOPICS, 2);
      reason = {
        short: "Exploring new topic",
        detail: `Introducing "${suggestedTopics[0]}" — a topic you haven't practiced yet. Expanding breadth builds a stronger foundation.`,
      };
      break;
    }

    case "familiar": {
      const familiar = allPracticedTopics.filter((t) => {
        const s = profile.topicSkills[t];
        return s && s.solved > 0;
      });
      suggestedTopics = familiar.length > 0
        ? pickRandom(familiar, 2)
        : pickRandom(CORE_TOPICS.slice(0, 3), 2);
      reason = {
        short: state === "revision" ? "Reviewing stale topic" : "Familiar warm-up",
        detail: state === "revision"
          ? `"${suggestedTopics[0]}" hasn't been practiced in over 14 days. A quick review keeps knowledge fresh.`
          : `Warm-up on "${suggestedTopics[0]}" — a topic you know — to rebuild momentum.`,
      };
      break;
    }

    case "interview-patterns": {
      const patterns = INTERVIEW_PATTERNS.filter((p) => !recentTags.includes(p));
      suggestedTopics = patterns.length > 0
        ? pickRandom(patterns, 2)
        : pickRandom(INTERVIEW_PATTERNS, 2);
      difficulty = "Medium";
      reason = {
        short: "Interview pattern practice",
        detail: `"${suggestedTopics[0]}" is a common interview pattern. Practicing these systematically prepares you for real technical interviews.`,
      };
      break;
    }

    case "mixed":
    default: {
      if (stale.length > 0 && Math.random() < 0.3) {
        suggestedTopics = pickRandom(stale, 2);
        reason = {
          short: "Refreshing stale knowledge",
          detail: `"${suggestedTopics[0]}" hasn't been practiced in a while. Periodic review prevents skill decay.`,
        };
      } else if (weak.length > 0 && Math.random() < 0.4) {
        suggestedTopics = pickRandom(weak, 2);
        reason = {
          short: `Strengthening: ${suggestedTopics[0]}`,
          detail: `Your mastery in "${suggestedTopics[0]}" is still low. A few more problems will solidify it.`,
        };
      } else {
        suggestedTopics = pickRandom(CORE_TOPICS, 2);
        reason = {
          short: "Balanced practice",
          detail: "Keeping skills sharp with a varied mix of topics and difficulty levels.",
        };
      }
      break;
    }
  }

  // If user typed last 3 questions on the same topic, force variety
  if (recentTags.length >= 2 && suggestedTopics.every((t) => recentTags.includes(t))) {
    const fresh = CORE_TOPICS.filter((t) => !recentTags.includes(t));
    if (fresh.length > 0) {
      suggestedTopics = pickRandom(fresh, 2);
      reason = {
        short: "Topic variety",
        detail: `You've done several "${recentTags[0]}" problems recently. Switching topics improves overall retention.`,
      };
    }
  }

  // If user provided a specific prompt, use it but keep the reason
  if (userPrompt && userPrompt !== "__auto_next__") {
    return {
      difficulty,
      suggestedTopics,
      avoidTopics: [],
      reason: {
        short: "User request",
        detail: `You asked for: "${userPrompt}". The AI will tailor it to your current level.`,
      },
      isCalibration: false,
    };
  }

  return {
    difficulty,
    suggestedTopics,
    avoidTopics: recentTags,
    reason,
    isCalibration: false,
  };
}

// ── HELPERS ──

function getRecentTags(questions: ExistingQuestion[], count: number): string[] {
  const recent = questions.slice(-count);
  const tags = recent.flatMap((q) => q.tags.map((t) => t.toLowerCase()));
  return [...new Set(tags)];
}

function findUnpracticedTopics(practicedTopics: string[]): string[] {
  const practiced = new Set(practicedTopics.map((t) => t.toLowerCase()));
  return CORE_TOPICS.filter((t) => !practiced.has(t));
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const CORE_TOPICS = [
  "array", "string", "hash map", "two pointers", "sliding window",
  "stack", "queue", "linked list", "binary search", "sorting",
  "recursion", "tree", "binary tree", "bst", "graph",
  "bfs", "dfs", "dynamic programming", "greedy", "backtracking",
  "heap", "trie", "bit manipulation", "math", "matrix",
];

const INTERVIEW_PATTERNS = [
  "two pointers", "sliding window", "binary search", "bfs", "dfs",
  "dynamic programming", "backtracking", "stack", "heap", "graph",
  "trie", "greedy", "hash map", "linked list", "tree",
];
