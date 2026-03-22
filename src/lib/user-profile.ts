import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { UserProfile, ExperienceLevel, GoalType } from "@/types";

const PROFILES_COLLECTION = "userProfiles";

export async function getOrCreateProfile(
  userId: string,
  defaults?: { experienceLevel?: ExperienceLevel; goalType?: GoalType }
): Promise<UserProfile> {
  const ref = adminDb.collection(PROFILES_COLLECTION).doc(userId);
  const snap = await ref.get();

  if (snap.exists) {
    const data = snap.data()!;
    // Merge in any new defaults (e.g. if user updates experience on a new project)
    if (defaults) {
      const updates: Record<string, unknown> = {};
      if (defaults.experienceLevel && data.experienceLevel !== defaults.experienceLevel) {
        updates.experienceLevel = defaults.experienceLevel;
      }
      if (defaults.goalType && data.goalType !== defaults.goalType) {
        updates.goalType = defaults.goalType;
      }
      if (Object.keys(updates).length > 0) {
        await ref.update(updates);
        Object.assign(data, updates);
      }
    }
    return { userId, ...data } as UserProfile;
  }

  const newProfile: Omit<UserProfile, "userId"> = {
    experienceLevel: defaults?.experienceLevel || "intermediate",
    goalType: defaults?.goalType || "daily-practice",
    topicSkills: {},
    totalSolved: 0,
    totalFailed: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: "",
  };

  await ref.set({ userId, ...newProfile });
  return { userId, ...newProfile };
}

export async function updateProfileAfterSubmission(
  userId: string,
  tags: string[],
  passed: boolean
): Promise<void> {
  const ref = adminDb.collection(PROFILES_COLLECTION).doc(userId);
  const snap = await ref.get();

  if (!snap.exists) {
    await getOrCreateProfile(userId);
  }

  const data = snap.exists ? snap.data()! : (await ref.get()).data()!;
  const topicSkills: Record<string, { solved: number; failed: number; lastSeen: unknown }> =
    data.topicSkills || {};

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  for (const tag of tags) {
    const normalizedTag = tag.toLowerCase();
    if (!topicSkills[normalizedTag]) {
      topicSkills[normalizedTag] = { solved: 0, failed: 0, lastSeen: FieldValue.serverTimestamp() };
    }
    if (passed) {
      topicSkills[normalizedTag].solved += 1;
    } else {
      topicSkills[normalizedTag].failed += 1;
    }
    topicSkills[normalizedTag].lastSeen = FieldValue.serverTimestamp();
  }

  let currentStreak = data.currentStreak || 0;
  let longestStreak = data.longestStreak || 0;
  const lastActiveDate: string = data.lastActiveDate || "";

  if (lastActiveDate !== todayStr) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (lastActiveDate === yesterdayStr) {
      currentStreak += 1;
    } else if (lastActiveDate === "") {
      currentStreak = 1;
    } else {
      currentStreak = 1;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  const updates: Record<string, unknown> = {
    topicSkills,
    currentStreak,
    longestStreak,
    lastActiveDate: todayStr,
  };

  if (passed) {
    updates.totalSolved = FieldValue.increment(1);
  } else {
    updates.totalFailed = FieldValue.increment(1);
  }

  await ref.update(updates);
}

export function getWeakTopics(profile: UserProfile): string[] {
  const weak: { topic: string; score: number }[] = [];

  for (const [topic, skill] of Object.entries(profile.topicSkills || {})) {
    const total = skill.solved + skill.failed;
    if (total === 0) continue;
    const passRate = skill.solved / total;
    if (passRate < 0.5 || total < 3) {
      weak.push({ topic, score: passRate });
    }
  }

  weak.sort((a, b) => a.score - b.score);
  return weak.map((w) => w.topic);
}

export function getRecommendedDifficulty(profile: UserProfile): "Easy" | "Medium" | "Hard" {
  const total = profile.totalSolved + profile.totalFailed;
  if (total === 0) {
    return profile.experienceLevel === "advanced" ? "Medium" : "Easy";
  }

  const passRate = profile.totalSolved / total;

  if (profile.experienceLevel === "beginner") {
    return passRate > 0.7 && total >= 5 ? "Medium" : "Easy";
  }
  if (profile.experienceLevel === "advanced") {
    if (passRate > 0.7 && total >= 5) return "Hard";
    return "Medium";
  }
  // intermediate
  if (passRate > 0.75 && total >= 8) return "Hard";
  if (passRate > 0.5) return "Medium";
  return "Easy";
}

export function buildPerformanceSummary(profile: UserProfile): string {
  const lines: string[] = [];
  const entries = Object.entries(profile.topicSkills || {});

  if (entries.length === 0) {
    lines.push("No topics practiced yet (new user).");
    return lines.join("\n");
  }

  lines.push("Topics practiced:");
  for (const [topic, skill] of entries) {
    const total = skill.solved + skill.failed;
    lines.push(`  - ${topic}: ${skill.solved}/${total} passed`);
  }

  const weak = getWeakTopics(profile);
  if (weak.length > 0) {
    lines.push(`Weak areas needing practice: ${weak.join(", ")}`);
  }

  const total = profile.totalSolved + profile.totalFailed;
  if (total > 0) {
    const rate = Math.round((profile.totalSolved / total) * 100);
    lines.push(`Overall success rate: ${rate}%`);
  }

  return lines.join("\n");
}
