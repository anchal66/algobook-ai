import { adminDb } from "@/lib/firebase-admin";
import { computeMasteryScore } from "@/lib/user-profile";
import type { LeaderboardEntry, TopicSkill } from "@/types";

/**
 * Leaderboard scoring formula:
 *   score = totalSolved * 2 + currentStreak * 5 + avgMastery * 0.5 + longestStreak * 2
 *
 * Rewards:
 *   - Volume: more problems solved
 *   - Consistency: active streaks (heavily weighted)
 *   - Quality: high mastery scores across topics
 *   - Persistence: longest streak as a lifetime achievement
 */
export function computeLeaderboardScore(data: {
  totalSolved: number;
  currentStreak: number;
  longestStreak: number;
  topicSkills: Record<string, TopicSkill>;
}): number {
  const { totalSolved, currentStreak, longestStreak, topicSkills } = data;

  // Average mastery across all practiced topics
  const skills = Object.values(topicSkills || {});
  const avgMastery = skills.length > 0
    ? skills.reduce((sum, s) => sum + (s.masteryScore ?? computeMasteryScore(s)), 0) / skills.length
    : 0;

  return Math.round(
    totalSolved * 2 +
    currentStreak * 5 +
    avgMastery * 0.5 +
    longestStreak * 2
  );
}

export function computeAvgMastery(topicSkills: Record<string, TopicSkill>): number {
  const skills = Object.values(topicSkills || {});
  if (skills.length === 0) return 0;
  return Math.round(
    skills.reduce((sum, s) => sum + (s.masteryScore ?? computeMasteryScore(s)), 0) / skills.length
  );
}

/**
 * Global leaderboard: ranks all users by score.
 * Returns paginated results + the requesting user's rank.
 */
export async function getGlobalLeaderboard(
  limit: number = 50,
  offset: number = 0,
  requestingUserId?: string,
): Promise<{ entries: LeaderboardEntry[]; userRank: number | null; userPercentile: number | null; total: number }> {
  // Fetch all profiles (for a real production system, this would use a
  // precomputed leaderboard collection. For now, compute on read.)
  const snapshot = await adminDb.collection("userProfiles").get();

  const allEntries: (LeaderboardEntry & { score: number })[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const topicSkills = (data.topicSkills || {}) as Record<string, TopicSkill>;
    const totalSolved = (data.totalSolved as number) || 0;

    // Skip users with no activity
    if (totalSolved === 0) continue;

    const score = computeLeaderboardScore({
      totalSolved,
      currentStreak: (data.currentStreak as number) || 0,
      longestStreak: (data.longestStreak as number) || 0,
      topicSkills,
    });

    allEntries.push({
      userId: doc.id,
      username: (data.username as string) || "anonymous",
      photoURL: (data.photoURL as string) || "",
      displayName: (data.displayName as string) || "",
      score,
      totalSolved,
      currentStreak: (data.currentStreak as number) || 0,
      avgMastery: computeAvgMastery(topicSkills),
      rank: 0,
    });
  }

  // Sort by score descending
  allEntries.sort((a, b) => b.score - a.score);

  // Assign ranks (handle ties)
  let currentRank = 1;
  for (let i = 0; i < allEntries.length; i++) {
    if (i > 0 && allEntries[i].score < allEntries[i - 1].score) {
      currentRank = i + 1;
    }
    allEntries[i].rank = currentRank;
  }

  // Find requesting user's rank
  let userRank: number | null = null;
  let userPercentile: number | null = null;
  if (requestingUserId) {
    const userEntry = allEntries.find((e) => e.userId === requestingUserId);
    if (userEntry) {
      userRank = userEntry.rank;
      userPercentile = Math.round((1 - (userEntry.rank - 1) / Math.max(1, allEntries.length)) * 100);
    }
  }

  // Paginate
  const paged = allEntries.slice(offset, offset + limit);

  return {
    entries: paged,
    userRank,
    userPercentile,
    total: allEntries.length,
  };
}

/**
 * Per-project leaderboard: ranks users who have submissions in a project.
 */
export async function getProjectLeaderboard(
  projectId: string,
  limit: number = 50,
  requestingUserId?: string,
): Promise<{ entries: LeaderboardEntry[]; userRank: number | null; userPercentile: number | null; total: number }> {
  // Fetch all submissions for this project
  const subsSnapshot = await adminDb
    .collection("submissions")
    .where("projectId", "==", projectId)
    .get();

  // Aggregate per user
  const userAgg: Record<string, { totalSolved: number; totalAttempts: number; userId: string }> = {};

  for (const doc of subsSnapshot.docs) {
    const data = doc.data();
    const uid = data.userId as string;
    if (!userAgg[uid]) {
      userAgg[uid] = { totalSolved: 0, totalAttempts: 0, userId: uid };
    }
    userAgg[uid].totalAttempts += 1;
    if (data.status === "success") {
      userAgg[uid].totalSolved += 1;
    }
  }

  // Fetch profile data for each user
  const userIds = Object.keys(userAgg);
  if (userIds.length === 0) {
    return { entries: [], userRank: null, userPercentile: null, total: 0 };
  }

  const entries: LeaderboardEntry[] = [];

  // Firestore 'in' queries limited to 30 at a time
  for (let i = 0; i < userIds.length; i += 30) {
    const batch = userIds.slice(i, i + 30);
    const profileSnap = await adminDb
      .collection("userProfiles")
      .where("userId", "in", batch)
      .get();

    for (const pDoc of profileSnap.docs) {
      const pData = pDoc.data();
      const uid = pDoc.id;
      const agg = userAgg[uid];
      if (!agg) continue;

      const topicSkills = (pData.topicSkills || {}) as Record<string, TopicSkill>;
      const successRate = agg.totalAttempts > 0 ? agg.totalSolved / agg.totalAttempts : 0;
      // Project score: solved * 3 + successRate * 20
      const score = Math.round(agg.totalSolved * 3 + successRate * 20);

      entries.push({
        userId: uid,
        username: (pData.username as string) || "anonymous",
        photoURL: (pData.photoURL as string) || "",
        displayName: (pData.displayName as string) || "",
        score,
        totalSolved: agg.totalSolved,
        currentStreak: (pData.currentStreak as number) || 0,
        avgMastery: computeAvgMastery(topicSkills),
        rank: 0,
      });
    }
  }

  entries.sort((a, b) => b.score - a.score);

  let currentRank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].score < entries[i - 1].score) {
      currentRank = i + 1;
    }
    entries[i].rank = currentRank;
  }

  let userRank: number | null = null;
  let userPercentile: number | null = null;
  if (requestingUserId) {
    const userEntry = entries.find((e) => e.userId === requestingUserId);
    if (userEntry) {
      userRank = userEntry.rank;
      userPercentile = Math.round((1 - (userEntry.rank - 1) / Math.max(1, entries.length)) * 100);
    }
  }

  return {
    entries: entries.slice(0, limit),
    userRank,
    userPercentile,
    total: entries.length,
  };
}
