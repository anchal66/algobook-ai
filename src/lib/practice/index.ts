import "server-only";
/**
 * Practice-intelligence surface consumed by Module 02 (`/api/projects/:id/next`).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ TEMPORARY (Module 02 A-07): `recommend()` and `summarizeForPrompt()` below   │
 * │ are deliberately simple stand-ins. Module 04 (P-06/P-15) replaces them with  │
 * │ the real bandit recommender and the ≤400-char profile summary, keeping these │
 * │ exact signatures. `getSeenProblemIds()` and the topic exports are final.     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
import type { Difficulty, Project, ProjectItem, RecommendationReason, TemplatePoolEntry, User, WithId } from "@/lib/data/schema";
import * as projects from "@/lib/data/projects";
import * as submissions from "@/lib/data/submissions";
import { CORE_TOPICS, INTERVIEW_PATTERNS, normalizeTags, type CoreTopic } from "@/lib/practice/topics";

export { CORE_TOPICS, INTERVIEW_PATTERNS, normalizeTags };
export type { CoreTopic };

export interface Recommendation {
  difficulty: Difficulty;
  topics: string[];
  avoidTopics: string[];
  reason: RecommendationReason;
  isCalibration: boolean;
  /** Set for template projects: the next pending company-list entry. */
  templateEntry: (WithId<TemplatePoolEntry> & { company: string }) | null;
}

export interface RecommendInput {
  user: User;
  project: WithId<Project>;
  existingItems: WithId<ProjectItem>[];
  userPrompt?: string;
}

/** Union of every problem linked to the user's projects and every accepted submission. */
export async function getSeenProblemIds(uid: string): Promise<string[]> {
  const [fromItems, fromAccepted] = await Promise.all([projects.itemProblemIdsForUser(uid), submissions.acceptedProblemIds(uid)]);
  return [...new Set([...fromItems, ...fromAccepted])];
}

/** Title substrings → likely topic, for template entries (ported from v1 `TITLE_TOPIC_HINTS`). */
const TITLE_TOPIC_HINTS: [RegExp, CoreTopic][] = [
  [/\btrie\b|prefix tree/i, "trie"],
  [/\bbst\b|binary search tree/i, "bst"],
  [/binary tree|\btree\b|preorder|inorder|postorder|ancestor/i, "binary tree"],
  [/\bgraph\b|island|network|connect|course schedule|clone/i, "graph"],
  [/\bbfs\b|level order|shortest path|rotting|ladder/i, "bfs"],
  [/\bdfs\b|flood fill|number of provinces/i, "dfs"],
  [/backtrack|permutation|combination|subset|n-queens|sudoku|word search/i, "backtracking"],
  [/subsequence|knapsack|coin change|house robber|climbing stair|edit distance|palindromic sub|partition|\bdp\b/i, "dynamic programming"],
  [/linked list|\blist\b.*node|reorder list|reverse nodes/i, "linked list"],
  [/binary search|search in rotated|find peak|kth smallest|median of two/i, "binary search"],
  [/sliding window|longest substring|minimum window|subarray/i, "sliding window"],
  [/two pointers|container with most water|3sum|trapping rain|sorted array/i, "two pointers"],
  [/\bheap\b|kth largest|top k|median|merge k/i, "heap"],
  [/\bstack\b|parenthes|calculator|daily temperature|histogram|monotonic/i, "stack"],
  [/\bqueue\b|circular|sliding window maximum/i, "queue"],
  [/matrix|spiral|rotate image|grid|board/i, "matrix"],
  [/\bbit\b|xor|single number|hamming|power of two/i, "bit manipulation"],
  [/interval|meeting rooms|merge intervals/i, "sorting"],
  [/anagram|palindrome|string|word|substring|character/i, "string"],
  [/prime|divide|sqrt|pow\(|integer|number|digit|factorial|math/i, "math"],
  [/hash|duplicate|frequency|group|count/i, "hash map"],
  [/greedy|jump game|gas station|candy/i, "greedy"],
  [/sort|order/i, "sorting"],
];

export function topicsFromTitle(title: string): CoreTopic[] {
  const out: CoreTopic[] = [];
  for (const [re, t] of TITLE_TOPIC_HINTS) if (re.test(title) && !out.includes(t)) out.push(t);
  return out.length ? out.slice(0, 2) : ["array"];
}

function difficultyFor(user: User, project: Project, items: ProjectItem[]): Difficulty {
  const total = user.stats.totalSolved + user.stats.totalFailed;
  const level = project.experienceLevel ?? user.experienceLevel;
  if (total === 0) return level === "advanced" ? "Medium" : "Easy";
  const passRate = user.stats.totalSolved / total;
  const solvedHere = items.filter((i) => i.status === "solved").length;
  if (level === "beginner") return passRate > 0.7 && solvedHere >= 3 ? "Medium" : "Easy";
  if (level === "advanced") return passRate > 0.7 && total >= 5 ? "Hard" : "Medium";
  if (passRate > 0.75 && total >= 8) return "Hard";
  return passRate > 0.5 ? "Medium" : "Easy";
}

function pick<T>(arr: readonly T[], n: number, seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

/**
 * TEMPORARY recommender (replaced by Module 04 P-15). Difficulty from experience level and pass
 * rate; topics from the project's `selectedTopics` (else the goal-appropriate list) minus the last
 * three items' tags; template projects follow the company list in order.
 */
export async function recommend(input: RecommendInput): Promise<Recommendation> {
  const { user, project, existingItems } = input;
  const recentTags = existingItems.slice(-3).flatMap((i) => i.tags);
  const difficulty = difficultyFor(user, project, existingItems);

  if (project.templateId) {
    const entry = await projects.nextPoolEntry(project.id);
    if (entry) {
      return {
        difficulty: entry.difficulty,
        topics: topicsFromTitle(entry.title),
        avoidTopics: [],
        reason: { short: `${project.templateId} list #${entry.order + 1}`, detail: `Next on the ${project.templateId} interview list: a variation of "${entry.title}" (${entry.difficulty}).` },
        isCalibration: false,
        templateEntry: { ...entry, company: project.templateId },
      };
    }
  }

  const promptTopics = input.userPrompt ? normalizeTags(input.userPrompt.toLowerCase().split(/[,;/]|\band\b|\bwith\b/).map((s) => s.trim())) : [];
  const preferred = normalizeTags(project.selectedTopics);
  const base: readonly string[] = promptTopics.length ? promptTopics : preferred.length ? preferred : project.goalType === "interview-prep" ? INTERVIEW_PATTERNS : CORE_TOPICS;
  const fresh = base.filter((t) => !recentTags.includes(t));
  const seed = existingItems.length * 7919 + (user.stats.totalSolved + 1) * 104729 + Date.now() % 1000;
  const topics = pick(fresh.length ? fresh : base, promptTopics.length ? Math.min(2, promptTopics.length) : 2, seed);
  const isCalibration = user.stats.totalSolved + user.stats.totalFailed === 0 && existingItems.length === 0;

  return {
    difficulty,
    topics,
    avoidTopics: recentTags.filter((t) => !topics.includes(t)).slice(0, 5),
    reason: promptTopics.length
      ? { short: `Your request: ${topics.join(", ")}`, detail: `You asked for ${topics.join(" and ")} at ${difficulty} level.` }
      : isCalibration
        ? { short: "Calibration", detail: `A representative ${difficulty} problem on ${topics[0]} to gauge your current level.` }
        : { short: `Practice: ${topics[0]}`, detail: `A ${difficulty} problem on ${topics.join(" and ")} — chosen from your project's focus areas, avoiding what you just practiced.` },
    isCalibration,
    templateEntry: null,
  };
}

/** TEMPORARY ≤400-char profile summary (Module 04 P-06 replaces it). */
export function summarizeForPrompt(user: User): string {
  const s = user.stats;
  const total = s.totalSolved + s.totalFailed;
  const skills = Object.entries(user.topicSkills ?? {}).filter(([, v]) => v.attempts > 0 || v.solved > 0);
  const weak = skills.filter(([, v]) => v.mastery < 50).sort((a, b) => a[1].mastery - b[1].mastery).slice(0, 3).map(([k]) => k);
  const strong = skills.filter(([, v]) => v.mastery >= 70).sort((a, b) => b[1].mastery - a[1].mastery).slice(0, 3).map(([k]) => k);
  const parts = [
    `state ${user.practiceState}`,
    `rating ${Math.round(s.rating)}`,
    total ? `pass rate ${Math.round((100 * s.totalSolved) / total)}% over ${total} submissions (E${s.easy}/M${s.medium}/H${s.hard} solved)` : "no submissions yet",
    weak.length ? `weak: ${weak.join(", ")}` : "",
    strong.length ? `strong: ${strong.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join("; ").slice(0, 400);
}
