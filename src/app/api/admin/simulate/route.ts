import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { handler } from "@/lib/api/handler";
import { UserStatsSchema, type Difficulty } from "@/lib/data/schema";
import { CORE_TOPICS } from "@/lib/practice/topics";
import { applySubmissionToStats } from "@/lib/practice/stats";
import { rng } from "@/lib/practice/recommend";

const BodySchema = z.object({
  count: z.number().int().min(1).max(50).default(10),
  seed: z.number().int().default(1),
  /** Restrict the synthetic submissions to these topics (canonical names). */
  topics: z.array(z.string()).max(5).optional(),
  passRate: z.number().min(0).max(1).default(0.7),
  /** Wipe stats / topicSkills / achievements of the caller first (admin's own doc only). */
  reset: z.boolean().default(false),
  /** Days back for the first synthetic submission (one per day → streaks). */
  daysBack: z.number().int().min(0).max(60).default(0),
});

const DIFFS: Difficulty[] = ["Easy", "Medium", "Hard"];

/**
 * DEV TOOL (admin only, Module 04 P-22): runs synthetic submissions through the real stats engine on the
 * caller's own user doc — no judge, no submission docs — so `/dev/api-smoke` can show mastery / SRS /
 * rating / xp / achievements moving. Never exposed to non-admins.
 */
export const POST = handler({ evt: "admin.simulate", admin: true, body: BodySchema }, async ({ user, body }) => {
  const userRef = adminDb.collection("users").doc(user.uid);
  const achRef = adminDb.collection("achievements").doc(user.uid);
  if (body.reset) {
    await userRef.update({ stats: UserStatsSchema.parse({}), topicSkills: {}, calibration: { complete: true, step: 3 }, practiceState: "learning", lastAppliedSubmissionId: null, updatedAt: Timestamp.now() });
    await achRef.set({ unlocked: [] });
  }
  const rand = rng(body.seed);
  const topics = body.topics?.length ? body.topics : [...CORE_TOPICS];
  const steps: Record<string, unknown>[] = [];
  const now = Date.now();
  for (let i = 0; i < body.count; i++) {
    const difficulty = DIFFS[Math.floor(rand() * 3)];
    const accepted = rand() < body.passRate;
    const attemptNumber = !accepted ? 1 + Math.floor(rand() * 3) : rand() < 0.7 ? 1 : 2;
    const tag = topics[Math.floor(rand() * topics.length)];
    const tag2 = rand() < 0.4 ? topics[Math.floor(rand() * topics.length)] : null;
    const at = new Date(now - Math.max(0, body.daysBack - i) * 86_400_000);
    const step = await adminDb.runTransaction(async (tx) => {
      const [u, a] = await Promise.all([tx.get(userRef), tx.get(achRef)]);
      const unlocked = ((a.data()?.unlocked as { id: string }[] | undefined) ?? []).map((x) => x.id);
      const r = applySubmissionToStats(u.data()!, unlocked, {
        submissionId: `sim_${body.seed}_${Date.now()}_${i}`, problemId: `sim_${i}`, accepted, firstAccept: accepted, alreadyAccepted: false, attemptNumber,
        difficulty, tags: tag2 && tag2 !== tag ? [tag, tag2] : [tag], language: rand() < 0.5 ? "java" : "python",
        timeSpentSec: Math.round(120 + rand() * 1800), hintsUsed: rand() < 0.25 ? 1 + Math.floor(rand() * 3) : 0, runCount: 1 + Math.floor(rand() * 5),
        editorialViewed: rand() < 0.1, problemRating: 1100 + Math.floor(rand() * 900), isDailyChallenge: false, now: at,
      });
      tx.update(userRef, r.updates);
      if (r.newlyUnlocked.length) tx.set(achRef, { unlocked: FieldValue.arrayUnion(...r.newlyUnlocked.map((id) => ({ id, at: Timestamp.now() }))) }, { merge: true });
      return {
        i, date: at.toISOString().slice(0, 10), accepted, difficulty, attemptNumber, topics: tag2 && tag2 !== tag ? [tag, tag2] : [tag],
        xp: r.xpEarned, rating: r.rating ? { before: r.rating.before, after: r.rating.user, delta: r.rating.delta } : null,
        streak: r.stats.currentStreak, freezes: r.stats.streakFreezes, level: r.stats.level, score: r.stats.score, state: r.practiceState,
        mastery: Object.fromEntries((tag2 && tag2 !== tag ? [tag, tag2] : [tag]).map((t) => [t, { mastery: r.topicSkills[t].mastery, srs: r.topicSkills[t].srs }])),
        unlocked: r.newlyUnlocked,
      };
    });
    steps.push(step);
  }
  const after = (await userRef.get()).data()!;
  return { steps, stats: after.stats, topicSkills: after.topicSkills, practiceState: after.practiceState, calibration: after.calibration };
});
