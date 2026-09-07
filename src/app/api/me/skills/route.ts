import { handler } from "@/lib/api/handler";
import { todayKey } from "@/lib/data/schema";
import { CORE_TOPICS, TOPIC_META, getPrerequisites, getTopicDepth } from "@/lib/practice/topics";
import { MASTERED_THRESHOLD, WEAK_THRESHOLD, isMastered, masteryBreakdown } from "@/lib/practice/mastery";
import { getDueTopics, normalizeSrs } from "@/lib/practice/srs";
import { prerequisiteGap, topicRatingOffset } from "@/lib/practice/recommend";
import { difficultyForRating } from "@/lib/practice/rating";
import { computePracticeState, getStateGuidance, getStateProgress } from "@/lib/practice/state";
import { streakStatus } from "@/lib/practice/stats";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { getByUsername } from "@/lib/data/users";
import type { AuthedUser } from "@/lib/auth/types";

export type SkillStatus = "locked" | "available" | "learning" | "weak" | "mastered";

/** Skill tree data (Module 04 §3.14): every core topic with mastery, SRS, prerequisites and a status. */
export const GET = handler<unknown, { username?: string }, AuthedUser | null>({ evt: "me.skills", auth: "optional", query: z.object({ username: z.string().max(20).optional() }) }, async ({ user: caller, query }) => {
  const today = todayKey();
  let u: AuthedUser["doc"];
  if (query.username) {
    const found = await getByUsername(query.username);
    if (!found || (!found.publicProfile && found.id !== caller?.uid)) throw ApiError.notFound("User not found");
    u = found;
  } else {
    if (!caller) throw ApiError.unauthenticated();
    u = caller.doc;
  }
  const due = new Map(getDueTopics(u.topicSkills, today).map((d) => [d.topic, d]));
  const topics = CORE_TOPICS.map((topic) => {
    const s = u.topicSkills[topic];
    const practised = !!s && s.attempts > 0;
    const gap = prerequisiteGap(u.topicSkills, topic);
    const status: SkillStatus = isMastered(s) ? "mastered" : practised ? (s!.mastery < WEAK_THRESHOLD ? "weak" : "learning") : gap ? "locked" : "available";
    const srs = s ? normalizeSrs(s.srs, today) : null;
    return {
      topic, ...TOPIC_META[topic], depth: getTopicDepth(topic), prerequisites: getPrerequisites(topic),
      status, gap,
      mastery: s?.mastery ?? 0, breakdown: s ? masteryBreakdown(s) : null,
      solved: s?.solved ?? 0, attempts: s?.attempts ?? 0, easy: s?.easy ?? 0, medium: s?.medium ?? 0, hard: s?.hard ?? 0,
      srs, due: due.get(topic) ?? null, lastSeen: s?.lastSeen ? s.lastSeen.toDate().toISOString() : null,
      suggestedDifficulty: difficultyForRating(u.stats.rating + topicRatingOffset(s)),
    };
  });
  const state = computePracticeState(u, today);
  return {
    state, stateDescription: getStateGuidance(state, u.goalType).description, stateProgress: getStateProgress(u, today),
    rating: u.stats.rating, band: difficultyForRating(u.stats.rating), level: u.stats.level, xp: u.stats.xp, score: u.stats.score,
    streak: { current: u.stats.currentStreak, longest: u.stats.longestStreak, freezes: u.stats.streakFreezes, ...streakStatus(u.stats, today) },
    thresholds: { weak: WEAK_THRESHOLD, mastered: MASTERED_THRESHOLD },
    counts: { mastered: topics.filter((t) => t.status === "mastered").length, weak: topics.filter((t) => t.status === "weak").length, due: due.size },
    topics,
  };
});
