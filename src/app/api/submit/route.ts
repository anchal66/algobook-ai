import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import * as projects from "@/lib/data/projects";
import * as submissions from "@/lib/data/submissions";
import * as activity from "@/lib/data/activity";
import { consumeQuotaInTx } from "@/lib/auth/quotas";
import { applySubmissionToStatsInTx } from "@/lib/practice/stats";
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
    timeSpentSec: z.number().int().min(0).max(86_400).default(0),
    runCount: z.number().int().min(0).max(10_000).default(0),
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
 * Judges hidden + sample tests server-side, then writes submission, activity,
 * project item/progress, problem stats and user counters in one transaction.
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

  const [priorCount, alreadyAccepted] = await Promise.all([
    submissions.countForProblem(user.uid, p.id),
    submissions.hasAccepted(user.uid, p.id),
  ]);
  const accepted = result.verdict === "AC";
  const firstAccept = accepted && !alreadyAccepted;
  const attemptNumber = priorCount + 1;
  const today = todayKey();
  const lang: Language = body.language;

  const subRef = submissions.newRef();
  const problemRef = adminDb.collection("problems").doc(p.id);
  const userRef = adminDb.collection("users").doc(user.uid);
  const projectRef = project ? adminDb.collection("projects").doc(project.id) : null;
  const itemRef = projectRef ? projectRef.collection("items").doc(p.id) : null;

  const submission = await adminDb.runTransaction(async (tx) => {
    const [problemSnap, userSnap, projectSnap, itemSnap] = await Promise.all([
      tx.get(problemRef), tx.get(userRef), projectRef ? tx.get(projectRef) : null, itemRef ? tx.get(itemRef) : null,
    ]);
    if (!userSnap.exists) throw ApiError.unauthenticated();
    const stats = (problemSnap.data()?.stats ?? {}) as { attempts?: number; accepted?: number; runtimeSamples?: Record<string, number[]>; memorySamples?: Record<string, number[]>; avgRuntimeMs?: Record<string, number> };

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
    tx.update(problemRef, problemUpdate);

    // project item + progress
    if (projectRef && projectSnap?.exists) {
      projects.applySubmitInTx(tx, { projectRef, project: projectSnap.data()!, item: itemSnap?.exists ? itemSnap.data()! : null },
        { problemId: p.id, accepted, difficulty: p.difficulty, title: p.title, tags: p.tags });
    }

    // user counters (stub; Module 04 owns the real engine) + activity + quota
    const xp = applySubmissionToStatsInTx(tx, userRef, userSnap.data()!, { accepted, firstAccept, difficulty: p.difficulty, tags: p.tags, timeSpentSec: body.meta.timeSpentSec });
    activity.recordInTx(tx, user.uid, today, {
      submissions: 1, accepted: accepted ? 1 : 0, timeSpentSec: body.meta.timeSpentSec, xpEarned: xp,
      ...(firstAccept ? { problemSolved: p.id } : {}),
    });
    consumeQuotaInTx(tx, userRef, userSnap.data()!, "submit");
    return { id: subRef.id, ...doc };
  });

  console.info(JSON.stringify({ evt: "submit.done", uid: user.uid, problemId: p.id, language: lang, verdict: result.verdict, passed: result.passed, total: result.total, judgeMs, batches: 1 }));

  const redacted = redactForClient(result, p.sampleTests.length);
  const { code: _code, ...rest } = submission;
  return { submission: serialize({ ...rest, failedCase: redacted.failedCase, xpEarned: 0 }), judge: { runtimeMs: result.runtimeMs, memoryKb: result.memoryKb } };
});
