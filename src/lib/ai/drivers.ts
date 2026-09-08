import "server-only";
import type { Language } from "@/lib/data/schema";
import * as problems from "@/lib/data/problems";
import { verifyReference } from "@/lib/judge/service";
import { asBackground, hasBackgroundBudget } from "@/lib/judge/budget";
import { LANGUAGES } from "@/lib/judge/languages";
import { aiCall, type AiResult } from "@/lib/ai/client";
import { DriverBundleSchema, type DriverBundle } from "@/lib/ai/schemas";
import { DRIVER_INSTRUCTIONS, buildDriverInput, type RepairFeedback } from "@/lib/ai/prompts";
import { feedbackFromJudge } from "@/lib/ai/generate";

/**
 * Extra-language drivers (Module 02 §3.3 step 7, D-01). Java is produced at generation time;
 * Python, C++ and JavaScript are generated + Judge-verified here — eagerly in the background
 * after every generation, or on demand from `POST /api/problems/:id/languages`.
 */

export const FAN_OUT_LANGUAGES: Language[] = ["python", "cpp", "javascript"];
const WAIT_POLL_MS = 2000;
const WAIT_MAX_MS = 90_000;

export interface EnsureResult {
  status: "ready" | "running" | "failed";
  starter?: string;
  error?: string;
  costUsd?: number;
}

async function waitForJob(problemId: string, language: Language, maxMs: number): Promise<EnsureResult> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    await new Promise((r) => setTimeout(r, WAIT_POLL_MS));
    const p = await problems.getPublic(problemId);
    if (!p) return { status: "failed", error: "Problem not found" };
    if (p.languages.includes(language)) return { status: "ready", starter: p.starter[language] };
    const job = p.languageJobs[language];
    if (job?.status === "failed") return { status: "failed", error: job.error ?? "Driver generation failed" };
  }
  return { status: "running" };
}

/**
 * Makes sure `language` has a verified driver. Idempotent: concurrent callers share one in-flight
 * job via `problems.languageJobs[lang]`; `wait` blocks (≤ 90 s) until it finishes.
 */
export async function ensureLanguage(problemId: string, language: Language, opts: { wait?: boolean; uid?: string } = {}): Promise<EnsureResult> {
  if (!LANGUAGES[language]?.enabled) return { status: "failed", error: `${language} is disabled` };
  const p = await problems.getPublic(problemId);
  if (!p) return { status: "failed", error: "Problem not found" };
  if (p.languages.includes(language)) return { status: "ready", starter: p.starter[language] };
  if (!p.languages.includes("java")) return { status: "failed", error: "Problem has no verified Java harness" };

  const claim = await problems.claimLanguageJob(problemId, language);
  if (claim === "ready") return { status: "ready", starter: (await problems.getPublic(problemId))?.starter[language] };
  if (claim === "running") return opts.wait ? waitForJob(problemId, language, WAIT_MAX_MS) : { status: "running" };

  const started = Date.now();
  let costUsd = 0;
  try {
    const [tests, drivers] = await Promise.all([problems.getPrivateTests(problemId), problems.getDrivers(problemId)]);
    if (!tests?.referenceSolution.java || !drivers?.drivers.java) throw new Error("Missing Java reference or driver");
    const base = {
      language, title: p.title, statementMd: p.statementMd, functionName: p.functionName, returnType: p.returnType, params: p.params,
      checker: p.checker, sampleTests: p.sampleTests, javaReference: tests.referenceSolution.java, javaDriver: drivers.drivers.java, javaStarter: p.starter.java ?? "",
    };
    const judgeProblem = { id: problemId, checker: p.checker, limits: p.limits, sampleTests: p.sampleTests, hiddenTests: tests.hiddenTests, drivers: {} as Partial<Record<Language, string>> };

    let bundle: DriverBundle | null = null;
    let lastError = "";
    let previous: DriverBundle | null = null;
    let feedback: RepairFeedback | null = null;
    for (let attempt = 0; attempt < 2 && !bundle; attempt++) {
      const res: AiResult<DriverBundle> = await aiCall({
        purpose: "driver", schema: DriverBundleSchema, schemaName: "driver_bundle", instructions: DRIVER_INSTRUCTIONS,
        input: buildDriverInput({ ...base, previous, feedback }), reasoning: attempt === 0 ? undefined : "high", uid: opts.uid, problemId,
      });
      costUsd += res.costUsd;
      const candidate: DriverBundle = res.data;
      const verdict = await verifyReference({ ...judgeProblem, drivers: { [language]: candidate.driver } }, language, candidate.reference);
      if (verdict.verdict === "AC") {
        bundle = candidate;
        await problems.addLanguage(problemId, language, candidate.driver, candidate.reference, candidate.starter);
        await problems.setReferenceRuntime(problemId, language, verdict.runtimeMs);
      } else {
        previous = candidate;
        feedback = feedbackFromJudge(verdict);
        lastError = `${verdict.verdict} ${verdict.passed}/${verdict.total}${verdict.failedCase ? `: ${(verdict.failedCase.compileOutput ?? verdict.failedCase.stderr ?? "").slice(0, 200)}` : ""}`;
      }
    }
    if (!bundle) {
      await problems.finishLanguageJob(problemId, language, "failed", lastError.slice(0, 500));
      console.warn(JSON.stringify({ evt: "driver.failed", problemId, language, error: lastError.slice(0, 300), costUsd, ms: Date.now() - started }));
      return { status: "failed", error: lastError, costUsd };
    }
    await problems.finishLanguageJob(problemId, language, "done");
    console.info(JSON.stringify({ evt: "driver.ready", problemId, language, costUsd, ms: Date.now() - started }));
    return { status: "ready", starter: bundle.starter, costUsd };
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 500) ?? "unknown error";
    await problems.finishLanguageJob(problemId, language, "failed", msg).catch(() => undefined);
    console.error(JSON.stringify({ evt: "driver.error", problemId, language, message: msg }));
    return { status: "failed", error: msg, costUsd };
  }
}

/** Background fan-out to every non-Java language; never throws (errors are logged per language). */
export async function fanOutLanguages(problemId: string, languages: Language[] = FAN_OUT_LANGUAGES, uid?: string): Promise<Record<string, EnsureResult>> {
  const out: Record<string, EnsureResult> = {};
  // Eagerly preparing 3 extra languages costs 3 judge batches per problem. On a capped judge that is the
  // difference between 12 problems/day and people being unable to run code, so it yields to the user reserve;
  // the language is then produced on demand the first time someone selects it ("Preparing…" for ~10 s).
  if (!(await hasBackgroundBudget())) {
    console.info(JSON.stringify({ evt: "drivers.fanout_deferred", problemId, reason: "judge budget reserved for users" }));
    for (const l of languages) out[l] = { status: "running" };
    return out;
  }
  const settled = await Promise.allSettled(languages.map((l) => asBackground(() => ensureLanguage(problemId, l, { uid }))));
  settled.forEach((s, i) => {
    out[languages[i]] = s.status === "fulfilled" ? s.value : { status: "failed", error: (s.reason as Error)?.message ?? "failed" };
  });
  return out;
}
