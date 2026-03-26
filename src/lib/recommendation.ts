import type { UserProfile, RecommendationReason, TemplatePoolEntry } from "@/types";
import {
  getWeakTopics,
  getRecommendedDifficulty,
  getTopicDifficulty,
} from "@/lib/user-profile";
import {
  computePracticeState,
  getCalibrationSpec,
  getStateGuidance,
  getDaysSinceActive,
} from "@/lib/practice-engine";
import { getDueTopics } from "@/lib/spaced-repetition";
import { suggestPrerequisite } from "@/lib/prerequisite-graph";

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
 *
 * Integrates:
 *   - Spaced repetition (SM-2 due topics replace flat stale detection)
 *   - Per-topic difficulty (topic mastery drives difficulty, not global rate)
 *   - Prerequisite awareness (redirect to prerequisites if gaps exist)
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
  const dueForReview = getDueTopics(profile); // SM-2 spaced repetition
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
      // For revision state, prioritize SM-2 due topics over arbitrary "familiar"
      if (state === "revision" && dueForReview.length > 0) {
        const freshDue = dueForReview.filter((t) => !recentTags.includes(t));
        suggestedTopics = freshDue.length > 0 ? freshDue.slice(0, 2) : dueForReview.slice(0, 2);
        const skill = profile.topicSkills?.[suggestedTopics[0]];
        const daysSinceReview = skill?.nextReviewDate
          ? Math.max(0, Math.floor((Date.now() - new Date(skill.nextReviewDate).getTime()) / 86400000))
          : 0;
        reason = {
          short: `Spaced review: ${suggestedTopics[0]}`,
          detail: `"${suggestedTopics[0]}" is ${daysSinceReview > 0 ? `${daysSinceReview} days overdue` : "due"} for spaced review. Timely review strengthens long-term retention.`,
        };
      } else {
        const familiar = allPracticedTopics.filter((t) => {
          const s = profile.topicSkills[t];
          return s && s.solved > 0;
        });
        suggestedTopics = familiar.length > 0
          ? pickRandom(familiar, 2)
          : pickRandom(CORE_TOPICS.slice(0, 3), 2);
        reason = {
          short: "Familiar warm-up",
          detail: `Warm-up on "${suggestedTopics[0]}" — a topic you know — to rebuild momentum.`,
        };
      }
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
      // Spaced repetition due topics get 60% priority (was 30% for stale)
      if (dueForReview.length > 0 && Math.random() < 0.6) {
        const freshDue = dueForReview.filter((t) => !recentTags.includes(t));
        suggestedTopics = freshDue.length > 0
          ? freshDue.slice(0, 2)
          : dueForReview.slice(0, 2);
        const skill = profile.topicSkills?.[suggestedTopics[0]];
        const daysSinceReview = skill?.nextReviewDate
          ? Math.max(0, Math.floor((Date.now() - new Date(skill.nextReviewDate).getTime()) / 86400000))
          : 0;
        reason = {
          short: `Spaced review: ${suggestedTopics[0]}`,
          detail: `"${suggestedTopics[0]}" is ${daysSinceReview > 0 ? `${daysSinceReview} days overdue` : "due"} for spaced review. Periodic reviews prevent skill decay.`,
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

  // ── PER-TOPIC DIFFICULTY ──
  // Override global difficulty with topic-specific difficulty for the primary topic
  if (suggestedTopics.length > 0) {
    const topicDiff = getTopicDifficulty(profile, suggestedTopics[0]);
    if (topicDiff !== difficulty) {
      const skill = profile.topicSkills?.[suggestedTopics[0].toLowerCase()];
      const mastery = skill?.masteryScore ?? 0;
      reason = {
        ...reason,
        detail: reason.detail + ` ${topicDiff} difficulty for "${suggestedTopics[0]}" because your mastery is ${mastery}%.`,
      };
      difficulty = topicDiff;
    }
  }

  // ── PREREQUISITE CHECK ──
  // If the selected topic has unmet prerequisites, redirect to the prerequisite
  if (suggestedTopics.length > 0) {
    const prereqSuggestion = suggestPrerequisite(profile, suggestedTopics[0]);
    if (prereqSuggestion && prereqSuggestion.shouldRedirect) {
      const originalTopic = suggestedTopics[0];
      suggestedTopics = [prereqSuggestion.suggestedTopic];
      difficulty = getTopicDifficulty(profile, prereqSuggestion.suggestedTopic);
      reason = {
        short: `Prerequisite: ${prereqSuggestion.suggestedTopic}`,
        detail: prereqSuggestion.reason,
      };
      // Keep the original topic in avoid list so it comes up later
      recentTags.push(originalTopic);
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

// ── TEMPLATE-AWARE RECOMMENDATION ──

export interface TemplateRecommendation extends Recommendation {
  selectedEntry: TemplatePoolEntry;
}

/**
 * Keywords mapping: title substrings → likely DSA topics.
 * Used to infer topic from template question titles for smart ordering.
 */
const TITLE_TOPIC_HINTS: [RegExp, string][] = [
  [/\btree\b|bst\b|binary tree\b|trie\b|preorder|inorder|postorder/i, "tree"],
  [/\bgraph\b|island|network|connect/i, "graph"],
  [/\bbfs\b|level order|shortest path/i, "bfs"],
  [/\bdfs\b|flood fill|backtrack/i, "dfs"],
  [/\bdynamic prog|dp\b|subsequence|knapsack|coin change|house robber|climbing stair/i, "dynamic programming"],
  [/\blinked list\b|listnode|node/i, "linked list"],
  [/\bstack\b|parenthes|valid paren|calculator/i, "stack"],
  [/\bqueue\b|sliding window|window/i, "sliding window"],
  [/\bheap\b|priority queue|k(th)?\s*(largest|smallest)|median/i, "heap"],
  [/\bbinary search\b|rotated.*sorted|search.*sorted|first bad/i, "binary search"],
  [/\bsort\b|merge.*sort|quick.*sort|sort color/i, "sorting"],
  [/\btwo (sum|pointer)|three sum|3sum|two pointer/i, "two pointers"],
  [/\bhash|anagram|group.*anagram|duplicate|two sum/i, "hash map"],
  [/\barray\b|subarray|matrix|rotate|spiral/i, "array"],
  [/\bstring\b|palindrome|substring|reverse.*string/i, "string"],
  [/\brecursion|recursive|permutation|combination|subset/i, "recursion"],
  [/\bgreedy\b|interval|jump game|gas station/i, "greedy"],
  [/\bbit\b|xor|single number|number of 1 bit/i, "bit manipulation"],
  [/\bmath\b|sqrt|power|factorial|prime/i, "math"],
];

function inferTopicsFromTitle(title: string): string[] {
  const topics: string[] = [];
  for (const [pattern, topic] of TITLE_TOPIC_HINTS) {
    if (pattern.test(title)) {
      topics.push(topic);
    }
  }
  return topics.length > 0 ? topics : ["general"];
}

/**
 * Recommend from a template pool — uses user intelligence but constrained to pending entries.
 *
 * Scoring per pending entry:
 *   +30  if difficulty matches recommended difficulty
 *   +25  if inferred topic aligns with a weak topic
 *   +20  if inferred topic is due for spaced review
 *   -15  if inferred topic was in the last 3 questions (anti-repetition)
 *   +10  bonus for lower order (slight preference for earlier entries — breadth first)
 */
export function recommendFromTemplate(
  profile: UserProfile,
  pendingPool: (TemplatePoolEntry & { docId: string })[],
  existingQuestions: ExistingQuestion[],
  userPrompt?: string,
): TemplateRecommendation | null {
  if (pendingPool.length === 0) return null;

  // If user typed a specific prompt, fuzzy-match against pool titles
  if (userPrompt && userPrompt !== "__auto_next__") {
    const lower = userPrompt.toLowerCase();
    const match = pendingPool.find((e) => e.title.toLowerCase().includes(lower));
    if (match) {
      return {
        difficulty: match.difficulty,
        suggestedTopics: inferTopicsFromTitle(match.title),
        avoidTopics: [],
        reason: {
          short: `Template: ${match.title}`,
          detail: `Matched your request "${userPrompt}" to template entry "${match.title}".`,
        },
        isCalibration: false,
        selectedEntry: match,
      };
    }
    // No match — still pick smartly but note the user requested something
  }

  const weak = getWeakTopics(profile);
  const weakSet = new Set(weak.map((t) => t.toLowerCase()));
  const dueForReview = getDueTopics(profile);
  const dueSet = new Set(dueForReview.map((t) => t.toLowerCase()));
  const baseDifficulty = getRecommendedDifficulty(profile);
  const recentTags = getRecentTags(existingQuestions, 3);
  const recentSet = new Set(recentTags);
  const maxOrder = Math.max(...pendingPool.map((e) => e.order), 1);

  // Score each pending entry
  const scored = pendingPool.map((entry) => {
    let score = 0;
    const topics = inferTopicsFromTitle(entry.title);

    // Difficulty alignment
    if (entry.difficulty === baseDifficulty) score += 30;

    // Weak topic alignment
    if (topics.some((t) => weakSet.has(t))) score += 25;

    // Spaced repetition alignment
    if (topics.some((t) => dueSet.has(t))) score += 20;

    // Anti-repetition penalty
    if (topics.some((t) => recentSet.has(t))) score -= 15;

    // Slight preference for earlier entries (breadth first)
    score += Math.round((1 - entry.order / maxOrder) * 10);

    // Small random jitter to avoid predictability
    score += Math.random() * 5;

    return { entry, score, topics };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const entry = best.entry;
  const topics = best.topics;

  const reason: RecommendationReason = {
    short: `Template: ${entry.title}`,
    detail: `Smart-picked "${entry.title}" (${entry.difficulty}) from the template. ${
      best.topics.some((t) => weakSet.has(t))
        ? `Aligns with your weak topic "${best.topics.find((t) => weakSet.has(t))}".`
        : best.topics.some((t) => dueSet.has(t))
        ? `Due for spaced review on "${best.topics.find((t) => dueSet.has(t))}".`
        : "Best fit for your current level."
    }`,
  };

  return {
    difficulty: entry.difficulty,
    suggestedTopics: topics,
    avoidTopics: recentTags,
    reason,
    isCalibration: false,
    selectedEntry: entry,
  };
}
