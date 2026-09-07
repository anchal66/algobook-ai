/**
 * Elo rating (Module 04 §3.5). Users start at 1200; problems are seeded 1100/1500/1900 by difficulty.
 * One rated outcome per (user, problem): S = 1 for an AC on the first attempt, 0.7 for a later AC,
 * 0 when the third attempt fails without an AC. K = 32 until 30 rated outcomes, then 16.
 * The problem moves K/4 the other way, bounded to 800..2600.
 */
import type { Difficulty } from "@/lib/data/schema";

export const RATING_SEED: Record<Difficulty, number> = { Easy: 1100, Medium: 1500, Hard: 1900 };
export const USER_START_RATING = 1200;
export const PROBLEM_MIN = 800;
export const PROBLEM_MAX = 2600;
export const USER_MIN = 400;
export const USER_MAX = 3500;
export const K_EARLY = 32;
export const K_LATE = 16;
export const K_SWITCH_AT = 30;
export const RATED_ATTEMPT_LIMIT = 3;

export function expectedScore(userRating: number, problemRating: number): number {
  return 1 / (1 + Math.pow(10, (problemRating - userRating) / 400));
}

export function kFor(ratedSolves: number): number {
  return ratedSolves < K_SWITCH_AT ? K_EARLY : K_LATE;
}

export type RatedOutcome = { kind: "first-try-ac" } | { kind: "later-ac" } | { kind: "failed-out" };

/**
 * Decides whether this submission produces a rated outcome.
 * `alreadyAccepted` / `attemptNumber` come from the submission history (server-side).
 */
export function ratedOutcomeFor(o: { accepted: boolean; attemptNumber: number; alreadyAccepted: boolean }): RatedOutcome | null {
  if (o.alreadyAccepted) return null;                    // rated on the first AC already
  if (o.attemptNumber > RATED_ATTEMPT_LIMIT) return null; // rated as failed-out on attempt 3
  if (o.accepted) return o.attemptNumber === 1 ? { kind: "first-try-ac" } : { kind: "later-ac" };
  return o.attemptNumber === RATED_ATTEMPT_LIMIT ? { kind: "failed-out" } : null;
}

export function scoreFor(outcome: RatedOutcome): number {
  return outcome.kind === "first-try-ac" ? 1 : outcome.kind === "later-ac" ? 0.7 : 0;
}

export interface RatingUpdate { user: number; problem: number; delta: number; expected: number; k: number }

export function applyRating(userRating: number, problemRating: number, ratedSolves: number, outcome: RatedOutcome): RatingUpdate {
  const k = kFor(ratedSolves);
  const expected = expectedScore(userRating, problemRating);
  const s = scoreFor(outcome);
  const delta = k * (s - expected);
  const user = clampRating(userRating + delta, USER_MIN, USER_MAX);
  const problem = clampRating(problemRating - delta / 4, PROBLEM_MIN, PROBLEM_MAX);
  return { user: round1(user), problem: round1(problem), delta: round1(delta), expected: Math.round(expected * 1000) / 1000, k };
}

function clampRating(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Difficulty whose seed rating is closest to `rating + 100` (pushes slightly upward). */
export function difficultyForRating(rating: number): Difficulty {
  const target = rating + 100;
  let best: Difficulty = "Easy";
  let bestDist = Infinity;
  for (const d of ["Easy", "Medium", "Hard"] as Difficulty[]) {
    const dist = Math.abs(RATING_SEED[d] - target);
    if (dist < bestDist) { best = d; bestDist = dist; }
  }
  return best;
}

export const DIFFICULTY_ORDER: Difficulty[] = ["Easy", "Medium", "Hard"];

export function shiftDifficulty(d: Difficulty, by: -1 | 0 | 1): Difficulty {
  const i = Math.min(2, Math.max(0, DIFFICULTY_ORDER.indexOf(d) + by));
  return DIFFICULTY_ORDER[i];
}
