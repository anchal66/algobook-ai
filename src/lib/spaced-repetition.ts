import type { TopicSkill, UserProfile } from "@/types";

/**
 * SM-2 inspired spaced repetition adapted for coding practice.
 *
 * Quality levels:
 *   0 = failed the problem
 *   1 = passed but with heavy help (3 hints OR very slow OR high struggle)
 *   2 = passed with moderate help (1-2 hints, reasonable time)
 *   3 = clean solve (first-try, good speed, no/minimal hints)
 *
 * The algorithm grows review intervals exponentially for high-quality solves
 * and resets to 1 day for failures, ensuring weak areas come back quickly
 * while mastered topics drift to monthly+ review cadence.
 */

export function computeReviewQuality(
  passed: boolean,
  hintsUsed: number,
  isFirstTry: boolean,
  timeEfficiency: number, // expectedTime/actualTime — >1 means fast, <1 means slow
): number {
  if (!passed) return 0;

  // Heavy help: 3 hints, or very slow (< 0.4 efficiency), or not first try with hints
  if (hintsUsed >= 3 || timeEfficiency < 0.4) return 1;

  // Moderate help: 1-2 hints, or slow-ish, or not first try
  if (hintsUsed >= 1 || !isFirstTry || timeEfficiency < 0.7) return 2;

  // Clean solve: first try, no hints, reasonable speed
  return 3;
}

export interface SpacedRepetitionUpdate {
  interval: number;       // days until next review
  easeFactor: number;     // updated ease factor
  nextReviewDate: string; // ISO YYYY-MM-DD
}

export function updateSpacedRepetition(
  skill: TopicSkill,
  quality: number, // 0-3
): SpacedRepetitionUpdate {
  const prevInterval = skill.interval || 1;
  const prevEF = skill.easeFactor || 2.5;

  let interval: number;
  let easeFactor: number;

  if (quality < 2) {
    // Failed or heavy-help: reset interval, penalize ease factor
    interval = 1;
    easeFactor = Math.max(1.3, prevEF - 0.2);
  } else {
    // Successful recall — grow interval
    // SM-2 ease factor adjustment: EF' = EF + (0.1 - (3-q) * (0.08 + (3-q) * 0.02))
    const delta = 0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02);
    easeFactor = Math.max(1.3, prevEF + delta);

    if (prevInterval <= 1) {
      interval = 1;
    } else if (prevInterval <= 3) {
      interval = Math.round(prevInterval * easeFactor);
    } else {
      interval = Math.round(prevInterval * easeFactor);
    }
    // Clamp: min 1 day, max 180 days (6 months)
    interval = Math.min(180, Math.max(1, interval));
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  const nextReviewDate = nextReview.toISOString().slice(0, 10);

  return { interval, easeFactor, nextReviewDate };
}

/**
 * Returns topics that are due for review (nextReviewDate <= today).
 * Sorted by urgency — most overdue first, then by lowest mastery.
 */
export function getDueTopics(profile: UserProfile): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const due: { topic: string; urgency: number }[] = [];

  for (const [topic, skill] of Object.entries(profile.topicSkills || {})) {
    if (skill.solved === 0) continue; // never practiced

    const reviewDate = skill.nextReviewDate;
    if (!reviewDate) {
      // Legacy data: no nextReviewDate set — treat as due if lastSeen is old enough
      due.push({ topic, urgency: 0.5 });
      continue;
    }

    if (reviewDate <= today) {
      const urgency = getTopicUrgency(skill, today);
      due.push({ topic, urgency });
    }
  }

  due.sort((a, b) => b.urgency - a.urgency);
  return due.map((d) => d.topic);
}

/**
 * Urgency score 0-1 for a due topic.
 * Combines how overdue the topic is with how poor the mastery is.
 * Higher = more urgent to review.
 */
export function getTopicUrgency(
  skill: TopicSkill,
  today?: string,
): number {
  const todayStr = today || new Date().toISOString().slice(0, 10);
  const reviewDate = skill.nextReviewDate;

  if (!reviewDate) return 0.5;

  const reviewMs = new Date(reviewDate).getTime();
  const todayMs = new Date(todayStr).getTime();
  const daysOverdue = Math.max(0, (todayMs - reviewMs) / (1000 * 60 * 60 * 24));

  // Overdue component: saturates at 1.0 after 14 days overdue
  const overdueScore = Math.min(1, daysOverdue / 14);

  // Mastery component: lower mastery = higher urgency
  const masteryDeficit = Math.max(0, 1 - (skill.masteryScore || 0) / 100);

  // Weighted: 60% overdue, 40% mastery deficit
  return overdueScore * 0.6 + masteryDeficit * 0.4;
}
