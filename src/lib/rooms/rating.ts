/**
 * Contest rating (Module 06 §3.8, D-17): a separate Elo-style rating per user (start 1500) updated once
 * per rated room from the final ranks, pairwise against every other ranked finisher. Pure.
 */
export const ROOM_RATING_START = 1500;
export const ROOM_RATING_MIN = 800;
export const ROOM_RATING_MAX = 3500;
export const ROOM_K_EARLY = 40;
export const ROOM_K_LATE = 24;
export const ROOM_K_SWITCH_AT = 5;
export const MIN_RANKED_FOR_RATING = 3;

export interface RatingParticipant { uid: string; rating: number; contests: number; rank: number; /** treated as last (similarity / heavy penalty) */ demoted?: boolean }

export function kFor(contests: number): number {
  return contests < ROOM_K_SWITCH_AT ? ROOM_K_EARLY : ROOM_K_LATE;
}

/** Expected score of a vs b. */
function expected(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** Rating deltas; null when fewer than MIN_RANKED_FOR_RATING participants. */
export function ratingDeltas(participants: RatingParticipant[]): Record<string, number> | null {
  if (participants.length < MIN_RANKED_FOR_RATING) return null;
  const worst = Math.max(...participants.map((p) => p.rank)) + 1;
  const effRank = (p: RatingParticipant) => (p.demoted ? worst : p.rank);
  const out: Record<string, number> = {};
  for (const p of participants) {
    let actual = 0, exp = 0;
    for (const q of participants) {
      if (q.uid === p.uid) continue;
      const rp = effRank(p), rq = effRank(q);
      actual += rp < rq ? 1 : rp === rq ? 0.5 : 0;
      exp += expected(p.rating, q.rating);
    }
    const n = participants.length - 1;
    const delta = Math.round(kFor(p.contests) * ((actual - exp) / n) * Math.sqrt(n));
    const next = Math.max(ROOM_RATING_MIN, Math.min(ROOM_RATING_MAX, p.rating + delta));
    out[p.uid] = next - p.rating;
  }
  return out;
}
