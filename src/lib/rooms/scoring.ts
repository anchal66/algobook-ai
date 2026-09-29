/**
 * Contest scoring (Module 06 §3.8). Pure and deterministic: given the settings, the timeline and a member's
 * submissions it computes per-problem points, penalties and the ranking. Recomputable from stored data.
 */
import type { Difficulty, Verdict } from "@/lib/data/schema";
import type { RoomSettings } from "@/lib/rooms/settings";

export interface ScoringProblem { problemId: string; difficulty: Difficulty; points: number }

export interface ScoringSubmission {
  problemId: string;
  verdict: Verdict;
  passed: number;
  total: number;
  /** ms since epoch */
  at: number;
}

export type ProblemStatus = "todo" | "attempting" | "solved";

export interface ProblemScore {
  status: ProblemStatus;
  points: number;
  attempts: number;
  /** Non-AC submissions before the first AC (compile errors excluded). */
  wrong: number;
  acceptedAt: number | null;
  bestPassed: number;
  total: number;
}

export interface MemberScore {
  perProblem: Record<string, ProblemScore>;
  /** Points before the integrity penalty. */
  raw: number;
  /** Integrity penalty percent applied. */
  penaltyPct: number;
  final: number;
  solved: number;
  /** Tie-break time in seconds: Σ (accept time − start) + wrong × wrongPenaltyMin × 60, over solved problems. */
  totalTimeSec: number;
  wrongSubmissions: number;
  lastAcceptedAt: number | null;
}

export function pointsFor(settings: RoomSettings, difficulty: Difficulty): number {
  return settings.scoring.points[difficulty];
}

/** Linear decay factor at `at` for a contest running from `startedAt` for `durationMin` minutes. */
export function decayFactor(settings: RoomSettings, startedAt: number, at: number): number {
  if (settings.scoring.timeDecay === "none") return 1;
  const duration = settings.durationMin * 60_000;
  const elapsed = Math.max(0, Math.min(duration, at - startedAt));
  const min = settings.scoring.minPct / 100;
  return 1 - (1 - min) * (elapsed / duration);
}

export function scoreProblem(settings: RoomSettings, problem: ScoringProblem, subs: ScoringSubmission[], startedAt: number): ProblemScore {
  const sorted = [...subs].filter((s) => s.problemId === problem.problemId).sort((a, b) => a.at - b.at);
  let wrong = 0, bestPassed = 0, total = 0, acceptedAt: number | null = null;
  for (const s of sorted) {
    total = Math.max(total, s.total);
    bestPassed = Math.max(bestPassed, s.passed);
    if (s.verdict === "AC") { acceptedAt = s.at; break; }
    if (s.verdict !== "CE") wrong++;
  }
  const P = problem.points;
  let points = 0;
  if (acceptedAt !== null) {
    points = P * decayFactor(settings, startedAt, acceptedAt);
    points -= wrong * (settings.scoring.wrongPenaltyPct / 100) * P;
  } else if (settings.scoring.partialCredit === "proportional" && total > 0 && bestPassed > 0) {
    points = 0.5 * P * (bestPassed / total);
  }
  points = Math.max(0, Math.round(points));
  return {
    status: acceptedAt !== null ? "solved" : sorted.length ? "attempting" : "todo",
    points, attempts: sorted.length, wrong, acceptedAt, bestPassed, total,
  };
}

export function scoreMember(settings: RoomSettings, problems: ScoringProblem[], subs: ScoringSubmission[], startedAt: number, penaltyPct: number): MemberScore {
  const perProblem: Record<string, ProblemScore> = {};
  let raw = 0, solved = 0, totalTimeSec = 0, wrongSubmissions = 0, lastAcceptedAt: number | null = null;
  for (const p of problems) {
    const ps = scoreProblem(settings, p, subs, startedAt);
    perProblem[p.problemId] = ps;
    raw += ps.points;
    wrongSubmissions += ps.wrong;
    if (ps.acceptedAt !== null) {
      solved++;
      totalTimeSec += Math.max(0, Math.round((ps.acceptedAt - startedAt) / 1000)) + ps.wrong * settings.scoring.wrongPenaltyMin * 60;
      lastAcceptedAt = Math.max(lastAcceptedAt ?? 0, ps.acceptedAt);
    }
  }
  const pct = Math.max(0, Math.min(100, penaltyPct));
  const final = Math.round(raw * (1 - pct / 100));
  return { perProblem, raw, penaltyPct: pct, final, solved, totalTimeSec, wrongSubmissions, lastAcceptedAt };
}

export interface RankInput {
  uid: string;
  state: "accepted" | "left" | "kicked" | "pending" | "rejected";
  score: Pick<MemberScore, "final" | "solved" | "totalTimeSec" | "wrongSubmissions">;
  violations: number;
  joinedAt: number;
}

export interface Ranked<T extends RankInput = RankInput> { member: T; rank: number | null }

/**
 * Sort: final desc, solved desc, totalTime asc, violations asc, joinedAt asc. Equal keys share a rank
 * (1, 1, 3). Kicked / pending / rejected members are unranked (rank null) and listed last.
 */
export function rank<T extends RankInput>(members: T[]): Ranked<T>[] {
  const eligible = members.filter((m) => m.state === "accepted" || m.state === "left");
  const others = members.filter((m) => !(m.state === "accepted" || m.state === "left"));
  const key = (m: T) => [-m.score.final, -m.score.solved, m.score.totalTimeSec, m.violations, m.joinedAt];
  const sorted = [...eligible].sort((a, b) => {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return a.uid.localeCompare(b.uid);
  });
  const out: Ranked<T>[] = [];
  let prevKey = "", prevRank = 0;
  sorted.forEach((m, i) => {
    const k = key(m).slice(0, 4).join("|");
    const r = k === prevKey ? prevRank : i + 1;
    prevKey = k; prevRank = r;
    out.push({ member: m, rank: r });
  });
  for (const m of others) out.push({ member: m, rank: null });
  return out;
}
