/**
 * Recommender v2 (Module 04 §3.6) — pure. v1 flow kept (calibration → signals → strategy by
 * state → topic filter → difficulty → prerequisite redirect → variety guard → user prompt) with:
 *   • a seeded bandit for topic choice inside a strategy,
 *   • difficulty from the Elo band (+ session-health adjust, server-clamped),
 *   • prerequisite redirect only when mastery < 45 **and** the prerequisite has < 2 solves,
 *   • `rationaleFacts[]` for the "Why this problem?" strip and `promptTopicsForPool` for `problems.search`.
 * The IO wrapper (`index.ts`) handles template pools and pre-generated problem preference.
 */
import type { Difficulty, Project, ProjectItem, RecommendationReason, TemplatePoolEntry, TopicSkill, WithId } from "@/lib/data/schema";
import { CORE_TOPICS, INTERVIEW_PATTERNS, difficultyInText, getPrerequisites, normalizeTags, topicsInText, type CoreTopic } from "@/lib/practice/topics";
import { WEAK_THRESHOLD, weakTopics } from "@/lib/practice/mastery";
import { getDueTopics, type DueTopic } from "@/lib/practice/srs";
import { difficultyForRating, shiftDifficulty } from "@/lib/practice/rating";
import { computePracticeState, familiarTopics, getCalibrationSpec, getSessionGuidance, getStateGuidance, shouldStartCalibration, type TopicStrategy, type UserLike } from "@/lib/practice/state";

export const PREREQ_REDIRECT_BELOW = 45;
export const PREREQ_MIN_SOLVED = 2;
const RECENT_ITEMS = 3;

export interface Recommendation {
  difficulty: Difficulty;
  topics: string[];
  avoidTopics: string[];
  reason: RecommendationReason;
  isCalibration: boolean;
  /** Set for template projects: the next company-list entry (filled by the IO wrapper). */
  templateEntry: (WithId<TemplatePoolEntry> & { company: string }) | null;
  /** Bullet facts for the "Why this problem?" strip. */
  rationaleFacts: string[];
  /** Topics to search the shared pool with (primary + alternates). */
  promptTopicsForPool: string[];
  /** Runner-up topics from the bandit. */
  alternates: string[];
  state: ReturnType<typeof computePracticeState>;
  strategy: TopicStrategy | "calibration" | "template" | "prompt";
  /** True when the route should persist `calibration: {complete:false, step:0}` (returning user). */
  startCalibration: boolean;
  sessionMessage: string | null;
}

export interface RecommendPureInput {
  user: UserLike;
  project: Pick<Project, "experienceLevel" | "goalType" | "selectedTopics" | "templateId">;
  existingItems: Pick<ProjectItem, "tags" | "title" | "difficulty" | "status">[];
  userPrompt?: string;
  topicFilter?: string[];
  sessionHealthScore?: number | null;
  /** Deterministic RNG seed (tests / reproducibility). */
  seed?: number;
  today: string;
}

// ── deterministic RNG (mulberry32) ──────────────────────────────────────────
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function recentTags(items: RecommendPureInput["existingItems"], count = RECENT_ITEMS): string[] {
  return [...new Set(items.slice(-count).flatMap((i) => i.tags.map((t) => t.toLowerCase())))];
}

export interface Candidate { topic: string; score: number; parts: { strategy: number; urgency: number; deficit: number; explore: number; recency: number } }

export const BANDIT = { strategy: 0.8, urgency: 0.6, deficit: 0.4, explore: 0.3, recency: [0.8, 0.7, 0.6], jitter: 0.05, temperature: 0.3 } as const;

/**
 * score = 0.8·strategy + 0.6·urgency(SRS) + 0.4·(1 − mastery/100) + 0.3/√(attempts+1) − recencyPenalty(last 3) + jitter(0.05)
 * Candidates are ranked by score; the pick is a Boltzmann sample (τ = 0.3) so a static profile still
 * spreads picks (no topic > 25 % over 100 picks) while weak/due topics keep the lion's share.
 */
export function banditScore(
  topics: readonly string[],
  ctx: { skills: Record<string, TopicSkill>; due: DueTopic[]; strategySet: Set<string>; recent: string[]; rand: () => number; strategyWeight?: number },
): Candidate[] {
  const dueMap = new Map(ctx.due.map((d) => [d.topic, d.urgency]));
  const out: Candidate[] = [];
  for (const topic of topics) {
    const s = ctx.skills[topic];
    const strategy = ctx.strategySet.has(topic) ? (ctx.strategyWeight ?? BANDIT.strategy) : 0;
    const urgency = BANDIT.urgency * (dueMap.get(topic) ?? 0);
    const deficit = BANDIT.deficit * (1 - (s?.mastery ?? 0) / 100);
    const explore = BANDIT.explore / Math.sqrt((s?.attempts ?? 0) + 1);
    const recencyIdx = ctx.recent.indexOf(topic);
    const recency = recencyIdx >= 0 ? (BANDIT.recency[Math.min(recencyIdx, BANDIT.recency.length - 1)] ?? 0) : 0;
    const jitter = ctx.rand() * BANDIT.jitter;
    out.push({ topic, score: strategy + urgency + deficit + explore - recency + jitter, parts: { strategy, urgency, deficit, explore, recency } });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Boltzmann pick over ranked candidates; returns [pick, ...alternates in score order]. Deterministic given `rand`. */
export function banditPick(ranked: Candidate[], rand: () => number, temperature = BANDIT.temperature): Candidate[] {
  if (!ranked.length) return [];
  const top = ranked[0].score;
  const weights = ranked.map((c) => Math.exp((c.score - top) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  let idx = 0;
  for (; idx < weights.length - 1; idx++) {
    r -= weights[idx];
    if (r <= 0) break;
  }
  const pick = ranked[idx];
  return [pick, ...ranked.filter((c) => c !== pick)];
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function prerequisiteGap(skills: Record<string, TopicSkill>, topic: string): { topic: string; mastery: number; solved: number } | null {
  let worst: { topic: string; mastery: number; solved: number } | null = null;
  for (const p of getPrerequisites(topic)) {
    const s = skills[p];
    const mastery = s?.mastery ?? 0;
    const solved = s?.solved ?? 0;
    if (mastery >= PREREQ_REDIRECT_BELOW) continue;
    if (solved >= PREREQ_MIN_SOLVED) continue; // one unlucky fail must not redirect
    if (!worst || mastery < worst.mastery) worst = { topic: p, mastery, solved };
  }
  return worst;
}

export function recommendPure(input: RecommendPureInput): Recommendation {
  const { user, project, existingItems, today } = input;
  const rand = rng(input.seed ?? (existingItems.length * 7919 + (user.stats.totalSolved + 1) * 104729 + user.stats.totalFailed * 31));
  const skills = user.topicSkills;
  const facts: string[] = [];
  const state = computePracticeState(user, today);
  const startCalibration = shouldStartCalibration(user, today);
  const calibrationStep = startCalibration ? 0 : user.calibration.step;
  const session = getSessionGuidance(input.sessionHealthScore);
  const recent = recentTags(existingItems);

  // ── calibration (returning user) ──
  if (startCalibration || !user.calibration.complete) {
    const spec = getCalibrationSpec(user, calibrationStep);
    if (spec) {
      facts.push(`Returning after a break — calibration step ${calibrationStep + 1} of 3`);
      facts.push(`${spec.difficulty} problem on ${spec.topic}`);
      return {
        difficulty: spec.difficulty, topics: [spec.topic], avoidTopics: [], isCalibration: true, templateEntry: null,
        reason: { short: `Calibration step ${calibrationStep + 1}/3`, detail: spec.reason, facts },
        rationaleFacts: facts, promptTopicsForPool: [spec.topic], alternates: [], state, strategy: "calibration", startCalibration,
        sessionMessage: session.message || null,
      };
    }
  }

  // ── signals ──
  const weak = weakTopics(skills);
  const due = getDueTopics(skills, today);
  const familiar = familiarTopics(skills);
  const practiced = new Set(Object.keys(skills).filter((t) => skills[t].attempts > 0));
  const unpracticed = CORE_TOPICS.filter((t) => !practiced.has(t));
  const guidance = getStateGuidance(state, user.goalType);
  facts.push(`Practice state: ${state}`);

  // ── strategy set ──
  // "strict" strategies sample only from their set (warm-up/revision stay on familiar or due topics,
  // interview prep on patterns, learning on unpracticed); "open" ones (weak-first, mixed) rank every topic
  // and let the strategy weight tilt the sample.
  let strategySet: string[];
  let strict = true;
  let reason: RecommendationReason;
  switch (guidance.topicStrategy) {
    case "weak-first":
      strategySet = weak.length ? weak : familiar;
      strict = false;
      break;
    case "new-topics": {
      // Introduce topics whose prerequisites are already met (depth-0 topics for a fresh user).
      const ready = unpracticed.filter((t) => !prerequisiteGap(skills, t));
      strategySet = ready.length ? ready : unpracticed.length ? unpracticed : [...CORE_TOPICS];
      break;
    }
    case "familiar":
      strategySet = state === "revision" && due.length ? due.map((d) => d.topic) : familiar.length ? familiar : ["array", "string", "hash map"];
      break;
    case "interview-patterns":
      strategySet = [...INTERVIEW_PATTERNS];
      break;
    default:
      strategySet = due.length ? due.map((d) => d.topic) : weak.length ? weak : [...CORE_TOPICS];
      strict = false;
  }

  // ── topic filter (explicit filter ∪ project focus) ──
  const filter = normalizeTags([...(input.topicFilter ?? []), ...(input.topicFilter?.length ? [] : project.selectedTopics)]);
  const filterSet = filter.length ? new Set<string>(filter) : null;
  const pool: string[] = filterSet
    ? [...filter]
    : strict ? [...new Set(strategySet)] : [...CORE_TOPICS];
  const candidates = pool.length ? pool : [...CORE_TOPICS];

  const ranked = banditPick(banditScore(candidates, { skills, due, strategySet: new Set(strategySet), recent, rand }), rand);
  let topics = ranked.slice(0, 2).map((c) => c.topic);
  const alternates = ranked.slice(1, 3).map((c) => c.topic);
  const primary = topics[0];
  const primarySkill = skills[primary];

  switch (guidance.topicStrategy) {
    case "weak-first":
      reason = { short: `Weak topic: ${primary}`, detail: `Your mastery in "${primary}" is ${pct(primarySkill?.mastery ?? 0)} — below ${WEAK_THRESHOLD}%. Focused practice here strengthens it fastest.`, facts };
      break;
    case "new-topics":
      reason = { short: `New topic: ${primary}`, detail: `Introducing "${primary}" — a topic you haven't practised yet. Breadth builds a stronger foundation.`, facts };
      break;
    case "familiar": {
      const d = due.find((x) => x.topic === primary);
      reason = d
        ? { short: `Spaced review: ${primary}`, detail: `"${primary}" is ${d.overdueDays > 0 ? `${d.overdueDays} day(s) overdue` : "due"} for spaced review. Timely review strengthens long-term retention.`, facts }
        : { short: `Familiar warm-up: ${primary}`, detail: `Warm-up on "${primary}" — a topic you know — to rebuild momentum.`, facts };
      break;
    }
    case "interview-patterns":
      reason = { short: `Interview pattern: ${primary}`, detail: `"${primary}" is a common interview pattern. Practising these systematically prepares you for real interviews.`, facts };
      break;
    default: {
      const d = due.find((x) => x.topic === primary);
      reason = d
        ? { short: `Spaced review: ${primary}`, detail: `"${primary}" is ${d.overdueDays > 0 ? `${d.overdueDays} day(s) overdue` : "due"} for review. Periodic reviews prevent skill decay.`, facts }
        : weak.includes(primary)
          ? { short: `Strengthening: ${primary}`, detail: `Your mastery in "${primary}" is still ${pct(primarySkill?.mastery ?? 0)}. A few more problems will solidify it.`, facts }
          : { short: "Balanced practice", detail: "Keeping skills sharp with a varied mix of topics and difficulties.", facts };
    }
  }
  if (filterSet) facts.push(`Constrained to your topics: ${filter.join(", ")}`);
  if (primarySkill?.attempts) facts.push(`${primary} mastery ${pct(primarySkill.mastery)} (${primarySkill.solved}/${primarySkill.attempts} solved)`);
  else facts.push(`${primary}: not practised yet`);
  const dueFact = due.find((x) => x.topic === primary);
  if (dueFact) facts.push(dueFact.overdueDays > 0 ? `Due for review ${dueFact.overdueDays} day(s) ago` : "Due for review today");

  // ── difficulty: Elo band → state bias → session adjust ──
  const band = difficultyForRating(user.stats.rating + topicRatingOffset(primarySkill));
  let difficulty: Difficulty = band;
  if (guidance.difficultyBias === "Easy") difficulty = "Easy";
  else if (guidance.difficultyBias === "Medium" && band === "Easy") difficulty = "Medium";
  facts.push(`Rating ${Math.round(user.stats.rating)} → ${band}${difficulty !== band ? ` (state bias → ${difficulty})` : ""}`);
  if (session.difficultyAdjust !== 0) {
    const adjusted = shiftDifficulty(difficulty, session.difficultyAdjust);
    if (adjusted !== difficulty) facts.push(`Session health ${Math.round(input.sessionHealthScore ?? 0)} → ${adjusted}`);
    difficulty = adjusted;
  }

  // ── prerequisite redirect ──
  let strategy: Recommendation["strategy"] = guidance.topicStrategy;
  const gap = prerequisiteGap(skills, primary);
  if (gap) {
    const original = primary;
    topics = [gap.topic];
    difficulty = difficultyForRating(user.stats.rating + topicRatingOffset(skills[gap.topic]));
    if (difficulty === "Hard") difficulty = "Medium";
    reason = {
      short: `Prerequisite: ${gap.topic}`,
      detail: gap.solved === 0 && gap.mastery === 0
        ? `We suggest "${gap.topic}" first — it's a prerequisite for "${original}" and you haven't practised it yet.`
        : `We suggest "${gap.topic}" first — it's a prerequisite for "${original}" and your ${gap.topic} mastery is only ${pct(gap.mastery)}.`,
      facts,
    };
    facts.push(`${gap.topic} is a prerequisite of ${original} (mastery ${pct(gap.mastery)}, ${gap.solved} solved)`);
    recent.push(original);
  }

  // ── variety guard ──
  if (recent.length >= 2 && topics.every((t) => recent.includes(t))) {
    const fresh = (filterSet ? filter : [...CORE_TOPICS]).filter((t) => !recent.includes(t));
    if (fresh.length) {
      const re = banditPick(banditScore(fresh, { skills, due, strategySet: new Set(strategySet), recent, rand }), rand);
      topics = re.slice(0, 2).map((c) => c.topic);
      reason = { short: "Topic variety", detail: `You've done several "${recent[0]}" problems recently. Switching topics improves overall retention.`, facts };
      facts.push(`Variety guard: last ${RECENT_ITEMS} problems were ${recent.slice(0, 3).join(", ")}`);
    }
  }

  // ── user prompt ──
  if (input.userPrompt) {
    const promptTopics = topicsInText(input.userPrompt);
    const promptDifficulty = difficultyInText(input.userPrompt);
    if (promptTopics.length || promptDifficulty) {
      strategy = "prompt";
      const t = promptTopics.length ? promptTopics : topics;
      const d = promptDifficulty ?? difficulty;
      facts.push(`Your request: ${[...t, d].join(", ")}`);
      return {
        difficulty: d, topics: t, avoidTopics: recent.filter((x) => !t.includes(x as CoreTopic)).slice(0, 5),
        reason: { short: `Your request: ${t.join(", ")}`, detail: `You asked for ${t.join(" and ")} at ${d} level.`, facts },
        isCalibration: false, templateEntry: null, rationaleFacts: facts, promptTopicsForPool: t, alternates,
        state, strategy, startCalibration, sessionMessage: session.message || null,
      };
    }
  }

  return {
    difficulty, topics, avoidTopics: recent.filter((t) => !topics.includes(t)).slice(0, 5), reason, isCalibration: false, templateEntry: null,
    rationaleFacts: facts, promptTopicsForPool: [...new Set([...topics, ...alternates])].slice(0, 3), alternates,
    state, strategy, startCalibration, sessionMessage: session.message || null,
  };
}

/** Practised topics shift the Elo band by (mastery − 50)·3 so weak topics come easier and strong ones harder. */
export function topicRatingOffset(skill: TopicSkill | undefined): number {
  if (!skill || skill.attempts === 0) return 0;
  return (skill.mastery - 50) * 3;
}

// ── template projects ────────────────────────────────────────────────────────

/** Title substrings → likely topic, for template entries (v1 `TITLE_TOPIC_HINTS`, extended). */
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

export interface ScoredPoolEntry { entry: WithId<TemplatePoolEntry>; score: number; topics: CoreTopic[]; matchedPrompt: boolean }

/**
 * v1 scoring: +30 difficulty match, +25 weak topic, +20 due topic, −15 recent tag, +10·(earlier order), + jitter(5).
 * A user prompt that matches a title wins outright. Deterministic given `seed`.
 */
export function scoreTemplatePool(
  user: UserLike, pool: WithId<TemplatePoolEntry>[], existingItems: RecommendPureInput["existingItems"],
  opts: { userPrompt?: string; topicFilter?: string[]; seed?: number; today: string },
): ScoredPoolEntry[] {
  if (!pool.length) return [];
  const rand = rng(opts.seed ?? pool.length * 131 + existingItems.length * 17);
  const filter = normalizeTags(opts.topicFilter ?? []);
  const filtered = filter.length ? pool.filter((e) => topicsFromTitle(e.title).some((t) => filter.includes(t))) : pool;
  const candidates = filtered.length ? filtered : pool;
  const prompt = opts.userPrompt?.trim().toLowerCase();
  const weak = new Set(weakTopics(user.topicSkills));
  const due = new Set(getDueTopics(user.topicSkills, opts.today).map((d) => d.topic));
  const base = difficultyForRating(user.stats.rating);
  const recent = new Set(recentTags(existingItems));
  const maxOrder = Math.max(1, ...candidates.map((e) => e.order));
  const scored = candidates.map((entry) => {
    const topics = topicsFromTitle(entry.title);
    let score = 0;
    if (entry.difficulty === base) score += 30;
    if (topics.some((t) => weak.has(t))) score += 25;
    if (topics.some((t) => due.has(t))) score += 20;
    if (topics.some((t) => recent.has(t))) score -= 15;
    score += Math.round((1 - entry.order / maxOrder) * 10);
    score += rand() * 5;
    const matchedPrompt = !!prompt && prompt.length >= 3 && entry.title.toLowerCase().includes(prompt);
    if (matchedPrompt) score += 1000;
    return { entry, score, topics, matchedPrompt };
  });
  return scored.sort((a, b) => b.score - a.score);
}

export function templateRecommendation(user: UserLike, pick: ScoredPoolEntry, company: string, existingItems: RecommendPureInput["existingItems"], today: string, extraFacts: string[] = []): Recommendation {
  const weak = new Set(weakTopics(user.topicSkills));
  const due = new Set(getDueTopics(user.topicSkills, today).map((d) => d.topic));
  const weakHit = pick.topics.find((t) => weak.has(t));
  const dueHit = pick.topics.find((t) => due.has(t));
  const facts = [`${company} interview list #${pick.entry.order + 1}: "${pick.entry.title}" (${pick.entry.difficulty})`, ...extraFacts];
  if (weakHit) facts.push(`Aligns with your weak topic ${weakHit}`);
  if (dueHit) facts.push(`${dueHit} is due for spaced review`);
  const recent = recentTags(existingItems);
  return {
    difficulty: pick.entry.difficulty, topics: pick.topics, avoidTopics: recent.filter((t) => !pick.topics.includes(t as CoreTopic)).slice(0, 5),
    reason: {
      short: pick.matchedPrompt ? `Template: ${pick.entry.title}` : `${company} list #${pick.entry.order + 1}`,
      detail: pick.matchedPrompt
        ? `Matched your request to the ${company} list entry "${pick.entry.title}".`
        : `Smart-picked "${pick.entry.title}" (${pick.entry.difficulty}) from the ${company} list. ${weakHit ? `Aligns with your weak topic "${weakHit}".` : dueHit ? `Due for spaced review on "${dueHit}".` : "Best fit for your current level."}`,
      facts,
    },
    isCalibration: false, templateEntry: { ...pick.entry, company }, rationaleFacts: facts, promptTopicsForPool: pick.topics, alternates: [],
    state: computePracticeState(user, today), strategy: "template", startCalibration: false, sessionMessage: null,
  };
}

// ── prompt summary ───────────────────────────────────────────────────────────

/** ≤ 400 chars: state, rating, top-3 weak, top-3 strong, due topics (≤ 3), pass rate. Replaces v1's unbounded table (C8). */
export function summarizeForPrompt(user: UserLike & { practiceState?: string }, today: string): string {
  const s = user.stats;
  const total = s.totalSolved + s.totalFailed;
  const practiced = Object.entries(user.topicSkills).filter(([, v]) => v.attempts > 0);
  const weak = practiced.filter(([, v]) => v.mastery < WEAK_THRESHOLD).sort((a, b) => a[1].mastery - b[1].mastery).slice(0, 3).map(([k, v]) => `${k} ${Math.round(v.mastery)}%`);
  const strong = practiced.filter(([, v]) => v.mastery >= 70).sort((a, b) => b[1].mastery - a[1].mastery).slice(0, 3).map(([k, v]) => `${k} ${Math.round(v.mastery)}%`);
  const due = getDueTopics(user.topicSkills, today).slice(0, 3).map((d) => d.topic);
  const parts = [
    `state ${computePracticeState(user, today)}`,
    `rating ${Math.round(s.rating)}`,
    total ? `pass rate ${Math.round((100 * s.totalSolved) / total)}% over ${total} submissions (E${s.easy}/M${s.medium}/H${s.hard})` : "no submissions yet",
    weak.length ? `weak: ${weak.join(", ")}` : "",
    strong.length ? `strong: ${strong.join(", ")}` : "",
    due.length ? `due for review: ${due.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join("; ").slice(0, 400);
}
