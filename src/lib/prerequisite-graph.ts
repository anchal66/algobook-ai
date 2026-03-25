import type { UserProfile, PrerequisiteGap } from "@/types";
import { computeMasteryScore } from "@/lib/user-profile";

/**
 * Static prerequisite DAG for coding topics.
 *
 * Format: topic → prerequisites that should be learned first.
 * A user attempting "dynamic programming" with weak "recursion" mastery
 * will be redirected to recursion first.
 *
 * Design principles:
 *   - Only represent strong pedagogical dependencies (not "nice to know")
 *   - Keep the graph shallow (max depth ~3) to prevent long redirect chains
 *   - Include only topics from CORE_TOPICS in recommendation.ts
 */

const PREREQUISITE_MAP: Record<string, string[]> = {
  "dynamic programming": ["recursion", "array"],
  "graph":              ["array"],
  "bfs":                ["graph", "queue"],
  "dfs":                ["graph", "stack", "recursion"],
  "trie":               ["string", "tree"],
  "bst":                ["binary tree", "sorting"],
  "binary tree":        ["tree"],
  "tree":               ["recursion"],
  "binary search":      ["array", "sorting"],
  "backtracking":       ["recursion"],
  "heap":               ["tree", "array"],
  "sliding window":     ["array", "two pointers"],
  "linked list":        ["array"],
  "two pointers":       ["array"],
  "stack":              ["array"],
  "queue":              ["array"],
};

// Minimum mastery a prerequisite must have to NOT be considered a gap
const MIN_PREREQUISITE_MASTERY = 50;

/**
 * Returns direct prerequisites for a topic.
 */
export function getPrerequisites(topic: string): string[] {
  return PREREQUISITE_MAP[topic.toLowerCase()] || [];
}

/**
 * Finds prerequisite topics that the user hasn't mastered sufficiently.
 * Returns gaps sorted by severity (lowest mastery first).
 */
export function findPrerequisiteGaps(
  profile: UserProfile,
  topic: string,
): PrerequisiteGap[] {
  const prereqs = getPrerequisites(topic);
  if (prereqs.length === 0) return [];

  const gaps: PrerequisiteGap[] = [];

  for (const prereq of prereqs) {
    const skill = profile.topicSkills?.[prereq];
    let currentMastery = 0;

    if (skill) {
      currentMastery = skill.masteryScore ?? computeMasteryScore(skill);
    }

    if (currentMastery < MIN_PREREQUISITE_MASTERY) {
      gaps.push({
        topic: prereq,
        requiredMastery: MIN_PREREQUISITE_MASTERY,
        currentMastery,
        prerequisiteOf: topic,
      });
    }
  }

  gaps.sort((a, b) => a.currentMastery - b.currentMastery);
  return gaps;
}

/**
 * Given a target topic, determines if the user should be redirected
 * to a prerequisite instead.
 *
 * Returns the most critical gap, or null if all prerequisites are met.
 * Only redirects if the gap is significant (mastery < 50).
 */
export function suggestPrerequisite(
  profile: UserProfile,
  intendedTopic: string,
): { shouldRedirect: boolean; suggestedTopic: string; reason: string } | null {
  const gaps = findPrerequisiteGaps(profile, intendedTopic);

  if (gaps.length === 0) return null;

  // Pick the worst gap — the prerequisite with lowest mastery
  const worst = gaps[0];

  // Only redirect if mastery is genuinely low (not just slightly below 50)
  // If they have 45+ mastery, the gap is marginal — let them try the target
  if (worst.currentMastery >= 45) return null;

  const masteryPct = Math.round(worst.currentMastery);
  const reason = worst.currentMastery === 0
    ? `We suggest "${worst.topic}" first — it's a prerequisite for "${intendedTopic}" and you haven't practiced it yet.`
    : `We suggest "${worst.topic}" first — it's a prerequisite for "${intendedTopic}" and your ${worst.topic} mastery is only ${masteryPct}%.`;

  return {
    shouldRedirect: true,
    suggestedTopic: worst.topic,
    reason,
  };
}

/**
 * Returns the depth of a topic in the prerequisite graph.
 * Topics with no prerequisites have depth 0.
 * Used for visualization / ordering.
 */
export function getTopicDepth(topic: string, visited?: Set<string>): number {
  const key = topic.toLowerCase();
  const prereqs = PREREQUISITE_MAP[key];

  if (!prereqs || prereqs.length === 0) return 0;

  // Guard against cycles
  const seen = visited || new Set<string>();
  if (seen.has(key)) return 0;
  seen.add(key);

  let maxDepth = 0;
  for (const prereq of prereqs) {
    maxDepth = Math.max(maxDepth, getTopicDepth(prereq, seen) + 1);
  }

  return maxDepth;
}

/**
 * Returns all topics in topological order (prerequisites first).
 * Useful for displaying a learning path.
 */
export function getTopologicalOrder(): string[] {
  const allTopics = new Set<string>();
  for (const [topic, prereqs] of Object.entries(PREREQUISITE_MAP)) {
    allTopics.add(topic);
    for (const p of prereqs) allTopics.add(p);
  }

  const topics = [...allTopics];
  topics.sort((a, b) => getTopicDepth(a) - getTopicDepth(b));
  return topics;
}
