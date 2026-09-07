import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import * as projects from "@/lib/data/projects";
import * as submissions from "@/lib/data/submissions";
import * as activity from "@/lib/data/activity";
import * as daily from "@/lib/data/daily";
import { consumeQuotaInTx } from "@/lib/auth/quotas";
import { applySubmissionToStatsInTx } from "@/lib/practice/stats";
import { getAchievement } from "@/lib/practice/achievements";
import { LanguageSchema, SubmissionSchema, serialize, todayKey, type Language } from "@/lib/data/schema";
import { judgeSubmission, redactForClient } from "@/lib/judge/service";

export const maxDuration = 60;
const SAMPLE_CAP = 500;

const BodySchema = z.object({
  problemId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  language: LanguageSchema,
  code: z.string().min(1).max(100_000),
  meta: z.object({
    hintsUsed: z.number().int().min(0).max(3).default(0),
    editorialViewed: z.boolean().default(false),
    timeSpentSec: z.number().int().min(0).default(0).transform((n) => Math.min(n, 86_400)),
    runCount: z.number().int().min(0).max(10_000).default(0),
    /** Local hour 0–23 (night-owl achievement); UTC when omitted. */
    localHour: z.number().int().min(0).max(23).optional(),
  }).default({ hintsUsed: 0, editorialViewed: false, timeSpentSec: 0, runCount: 0 }),
});

function beats(samples: number[] | undefined, mine: number): number {
  if (!samples?.length) return 100;
  const slower = samples.filter((s) => s > mine).length;
  return Math.round((100 * slower) / samples.length);
}

function appendSample(samples: number[] | undefined, v: number): number[] {
  const next = [...(samples ?? []), v];
  return next.length > SAMPLE_CAP ? next.slice(next.length - SAMPLE_CAP) : next;
}

/**
 * Judges hidden + sample tests server-side, then writes submission, activity, project item/progress,
 * problem stats + rating, user stats (mastery/SRS/rating/xp/streak — Module 04 engine) and
 * achievements in one transaction.
 */
export const POST = handler({ evt: "submit", feature: "submit", body: BodySchema }, async ({ user, body }) => {
  const p = await problems.resolve(body.problemId);
  if (!p || p.status === "draft") throw ApiError.notFound("Problem not found");
  if (!p.languages.includes(body.language)) throw new ApiError(409, "LANGUAGE_NOT_READY", `${body.language} is not available for this problem yet`);
  const [tests, drivers] = await Promise.all([problems.getPrivateTests(p.id), problems.getDrivers(p.id)]);
  if (!tests || !drivers) throw ApiError.internal("Problem is missing private data");
  const project = body.projectId ? await projects.getOwned(body.projectId, user.uid) : null;

  const judgeStarted = Date.now();
  const result = await judgeSubmission(
    { id: p.id, checker: p.checker, limits: p.limits, sampleTests: p.sampleTests, hiddenTests: tests.hiddenTests, drivers: drivers.drivers },
    body.language, body.code,
  );
  const judgeMs = Date.now() - judgeStarted;

  const today = todayKey();
  const [priorCount, alreadyAccepted, todaysDaily, templateCount] = await Promise.all([
    submissions.countForProblem(user.uid, p.id),
    submissions.hasAccepted(user.uid, p.id),
    daily.get(today),
    project?.templateId ? projects.templateItemCount(project.templateId) : Promise.resolve(0),
  ]);
  const accepted = result.verdict === "AC";
  const firstAccept = accepted && !alreadyAccepted;
  const attemptNumber = priorCount + 1;
  const lang: Language = body.language;

  const subRef = submissions.newRef();
  const problemRef = adminDb.collection("problems").doc(p.id);
  const userRef = adminDb.collection("users").doc(user.uid);
  const achievementsRef = adminDb.collection("achievements").doc(user.uid);
  const activityRef = activity.ref(user.uid, today);
  const projectRef = project ? adminDb.collection("projects").doc(project.id) : null;
  const itemRef = projectRef ? projectRef.collection("items").doc(p.id) : null;

  const outcome = await adminDb.runTransaction(async (tx) => {
    const [problemSnap, userSnap, achSnap, actSnap, projectSnap, itemSnap] = await Promise.all([
      tx.get(problemRef), tx.get(userRef), tx.get(achievementsRef), tx.get(activityRef), projectRef ? tx.get(projectRef) : null, itemRef ? tx.get(itemRef) : null,
    ]);
    if (!userSnap.exists) throw ApiError.unauthenticated();
    const problemData = problemSnap.data() ?? {};
    const stats = (problemData.stats ?? {}) as { attempts?: number; accepted?: number; runtimeSamples?: Record<string, number[]>; memorySamples?: Record<string, number[]>; avgRuntimeMs?: Record<string, number> };

    const beatsRuntimePct = accepted ? beats(stats.runtimeSamples?.[lang], result.runtimeMs) : null;
    const beatsMemoryPct = accepted ? beats(stats.memorySamples?.[lang], result.memoryKb) : null;

    const doc = SubmissionSchema.parse({
      uid: user.uid, projectId: project?.id ?? null, problemId: p.id, language: lang, code: body.code,
      verdict: result.verdict, passed: result.passed, total: result.total,
      failedCase: result.failedCase ? { index: result.failedCase.index, input: result.failedCase.input, expected: result.failedCase.expected ?? "", actual: result.failedCase.actual, stderr: result.failedCase.stderr } : null,
      compileOutput: result.compileOutput,
      runtimeMs: result.runtimeMs, memoryKb: result.memoryKb, beatsRuntimePct, beatsMemoryPct,
      attemptNumber, hintsUsed: body.meta.hintsUsed, editorialViewed: body.meta.editorialViewed,
      timeSpentSec: body.meta.timeSpentSec, runCount: body.meta.runCount, isFirstTry: accepted && attemptNumber === 1,
      createdAt: Timestamp.now(),
    });
    tx.set(subRef, doc);

    // problems.stats
    const attempts = (stats.attempts ?? 0) + 1;
    const acceptedCount = (stats.accepted ?? 0) + (accepted ? 1 : 0);
    const problemUpdate: Record<string, unknown> = { "stats.attempts": attempts, "stats.accepted": acceptedCount, "stats.acceptanceRate": Math.round((1000 * acceptedCount) / attempts) / 10 };
    if (accepted) {
      const rs = appendSample(stats.runtimeSamples?.[lang], result.runtimeMs);
      const ms = appendSample(stats.memorySamples?.[lang], result.memoryKb);
      problemUpdate[`stats.runtimeSamples.${lang}`] = rs;
      problemUpdate[`stats.memorySamples.${lang}`] = ms;
      problemUpdate[`stats.avgRuntimeMs.${lang}`] = Math.round(rs.reduce((a, b) => a + b, 0) / rs.length);
    }

    // project item + progress (+ pace)
    let templateCompleted: string | null = null;
    if (projectRef && projectSnap?.exists) {
      const applied = projects.applySubmitInTx(tx, { projectRef, project: projectSnap.data()!, item: itemSnap?.exists ? itemSnap.data()! : null },
        { problemId: p.id, accepted, difficulty: p.difficulty, title: p.title, tags: p.tags });
      if (project?.templateId && accepted && templateCount > 0 && applied.solved >= templateCount) templateCompleted = project.templateId;
    }

    // daily challenge (awarded once per day, only through an AC)
    const isDailyChallenge = accepted && !!todaysDaily && todaysDaily.problemId === p.id && !(actSnap.data()?.dailySolved === true);
    if (isDailyChallenge) daily.recordSolveInTx(tx, today);

    // user stats engine (Module 04): mastery, SRS, rating, xp/level/score, streak+freezes, calibration, achievements
    const engine = applySubmissionToStatsInTx(tx, {
      userRef, userData: userSnap.data()!, achievementsRef, achievementsData: achSnap.exists ? achSnap.data()! : null, problemRef,
    }, {
      submissionId: subRef.id, problemId: p.id, accepted, firstAccept, alreadyAccepted, attemptNumber,
      difficulty: p.difficulty, tags: p.tags, language: lang, timeSpentSec: body.meta.timeSpentSec, hintsUsed: body.meta.hintsUsed,
      runCount: body.meta.runCount, editorialViewed: body.meta.editorialViewed, problemRating: (problemData.rating as number) ?? p.rating,
      isDailyChallenge, localHour: body.meta.localHour, templateCompleted,
    });
    // the engine writes `rating` on the problem; fold the stats update into the same write
    tx.update(problemRef, problemUpdate);

    activity.recordInTx(tx, user.uid, today, {
      submissions: 1, accepted: accepted ? 1 : 0, timeSpentSec: body.meta.timeSpentSec, xpEarned: engine.xpEarned,
      ...(firstAccept ? { problemSolved: p.id } : {}),
      ...(project ? { projectId: project.id } : {}),
      ...(isDailyChallenge ? { dailySolved: true } : {}),
    });
    consumeQuotaInTx(tx, userRef, userSnap.data()!, "submit");
    return { submission: { id: subRef.id, ...doc }, engine, isDailyChallenge };
  });

  const { engine } = outcome;
  console.info(JSON.stringify({ evt: "submit.done", uid: user.uid, problemId: p.id, language: lang, verdict: result.verdict, passed: result.passed, total: result.total, judgeMs, xp: engine.xpEarned, unlocked: engine.newlyUnlocked, rating: engine.rating?.user ?? null }));

  const redacted = redactForClient(result, p.sampleTests.length);
  const { code: _code, ...rest } = outcome.submission;
  return {
    submission: serialize({ ...rest, failedCase: redacted.failedCase, xpEarned: engine.xpEarned }),
    judge: { runtimeMs: result.runtimeMs, memoryKb: result.memoryKb },
    xpEarned: engine.xpEarned,
    newlyUnlocked: engine.newlyUnlocked.map((id) => ({ id, ...(getAchievement(id) ? { name: getAchievement(id)!.name, description: getAchievement(id)!.description, icon: getAchievement(id)!.icon } : {}) })),
    rating: engine.rating ? { before: engine.rating.before, after: engine.rating.user, delta: engine.rating.delta, problem: engine.rating.problem } : null,
    streakFreezeUsed: engine.streakFreezeUsed,
    stats: { xp: engine.stats.xp, level: engine.stats.level, currentStreak: engine.stats.currentStreak, longestStreak: engine.stats.longestStreak, streakFreezes: engine.stats.streakFreezes, rating: engine.stats.rating, score: engine.stats.score, totalSolved: engine.stats.totalSolved },
    practiceState: engine.practiceState,
    calibration: engine.calibration,
    daily: { solved: outcome.isDailyChallenge },
  };
});
