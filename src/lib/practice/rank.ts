/** Pure ranking helpers for the leaderboard (Module 04 §3.10). */
import type { LeaderboardEntry } from "@/lib/data/schema";

export interface RankedUser extends LeaderboardEntry { rating: number; level: number; longestStreak: number }

export function entryFromUser(uid: string, d: Record<string, unknown>, rank: number): RankedUser {
  const s = ((d.stats ?? {}) as Record<string, number>);
  return {
    uid, username: (d.username as string) ?? "", displayName: (d.displayName as string) ?? "", photoURL: (d.photoURL as string) ?? "",
    score: s.score ?? 0, totalSolved: s.totalSolved ?? 0, currentStreak: s.currentStreak ?? 0, longestStreak: s.longestStreak ?? 0,
    rating: s.rating ?? 1200, level: s.level ?? 1, rank,
  };
}

/** Competition ranking ("1224"): ties share a rank, given the rank of the first entry. */
export function assignRanks<T extends { score: number }>(entries: T[], baseRank: number): (T & { rank: number })[] {
  let rank = baseRank;
  return entries.map((e, i) => {
    if (i > 0 && e.score < entries[i - 1].score) rank = baseRank + i;
    return { ...e, rank };
  });
}

/** Percentile (0–100) for a rank among `total` ranked users. */
export function percentileFor(rank: number, total: number): number | null {
  return total > 0 ? Math.round((1 - (rank - 1) / total) * 100) : null;
}
