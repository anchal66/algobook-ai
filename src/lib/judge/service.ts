import "server-only";
import type { Checker, Language, Limits, TestCase, Verdict } from "@/lib/data/schema";
import { ApiError } from "@/lib/api/errors";
import { assemble } from "@/lib/judge/assemble";
import { compare } from "@/lib/judge/checkers";
import { JUDGE0_STATUS, runBatch, verifyLanguages, type BatchItem, type RawSubmission } from "@/lib/judge/judge0";
import { LANGUAGES } from "@/lib/judge/languages";
import type { CaseInput, CaseResult, CaseStatus, JudgeResult } from "@/lib/judge/types";

export const OUTPUT_CAP = 64 * 1024;

/** Everything the judge needs about a problem (callers load public + private docs). */
export interface JudgeProblem {
  id: string;
  checker: Checker;
  limits: Limits;
  sampleTests: TestCase[];
  hiddenTests: TestCase[];
  drivers: Partial<Record<Language, string>>;
}

function cap(s: string): string {
  return s.length > OUTPUT_CAP ? s.slice(0, OUTPUT_CAP) + "\n…[truncated]" : s;
}

function statusFor(raw: RawSubmission, expected: string | undefined, checker: Checker): CaseStatus {
  const id = raw.status.id;
  if (id === JUDGE0_STATUS.COMPILATION_ERROR) return "CE";
  if (id === JUDGE0_STATUS.TLE) return "TLE";
  if (id === JUDGE0_STATUS.INTERNAL_ERROR || id === JUDGE0_STATUS.EXEC_FORMAT_ERROR) return "IE";
  if (id >= JUDGE0_STATUS.RE_SIGSEGV && id <= JUDGE0_STATUS.RE_OTHER) {
    // Judge0 reports MLE as SIGSEGV/SIGABRT with memory near the limit; surface it as MLE when the message says so.
    return /memory/i.test(raw.message ?? "") ? "MLE" : "RE";
  }
  if (id === JUDGE0_STATUS.WRONG_ANSWER) return "WA";
  if (id === JUDGE0_STATUS.ACCEPTED) {
    if (expected === undefined) return "AC";
    return compare(checker, expected, raw.stdout ?? "") ? "AC" : "WA";
  }
  return "IE";
}

function toCaseResult(index: number, c: CaseInput, raw: RawSubmission, checker: Checker): CaseResult {
  const status = statusFor(raw, c.expected, checker);
  return {
    index,
    status,
    passed: status === "AC",
    input: c.input,
    expected: c.expected ?? null,
    actual: cap(raw.stdout ?? ""),
    stderr: cap(raw.stderr ?? "") || (status === "IE" ? raw.message ?? "" : ""),
    compileOutput: raw.compile_output ? cap(raw.compile_output) : null,
    timeMs: raw.time ? Math.round(parseFloat(raw.time) * 1000) : 0,
    memoryKb: raw.memory ?? 0,
  };
}

function buildItems(problem: JudgeProblem, language: Language, source: string, cases: CaseInput[]): BatchItem[] {
  const lang = LANGUAGES[language];
  const cpu = Math.min(15, problem.limits.cpuTimeSec * lang.cpuFactor);
  return cases.map((c) => ({
    source_code: source,
    language_id: lang.id,
    stdin: c.input,
    cpu_time_limit: cpu,
    wall_time_limit: Math.min(20, cpu + 3),
    memory_limit: Math.min(256000, problem.limits.memoryKb),
  }));
}

/**
 * Runs `cases` for one program in a single Judge0 batch round-trip (+ polling).
 * Internal errors (status 13) are retried once for the affected cases only.
 */
export async function runCases(problem: JudgeProblem, language: Language, userCode: string, cases: CaseInput[]): Promise<CaseResult[]> {
  const driver = problem.drivers[language];
  if (!driver) throw new ApiError(409, "LANGUAGE_NOT_READY", `No verified ${LANGUAGES[language].label} driver for this problem yet`);
  if (!LANGUAGES[language].enabled) throw ApiError.validation(`${language} is disabled`);
  if (!cases.length) return [];
  await verifyLanguages();

  const source = assemble(language, userCode, driver);
  const items = buildItems(problem, language, source, cases);
  const raws = await runBatch(items);

  const retryIdx = raws.map((r, i) => (r.status.id === JUDGE0_STATUS.INTERNAL_ERROR ? i : -1)).filter((i) => i >= 0);
  if (retryIdx.length) {
    console.warn(JSON.stringify({ evt: "judge0.retry_internal", problemId: problem.id, count: retryIdx.length }));
    const again = await runBatch(retryIdx.map((i) => items[i]));
    retryIdx.forEach((i, k) => { raws[i] = again[k]; });
  }
  return raws.map((raw, i) => toCaseResult(i, cases[i], raw, problem.checker));
}

function summarize(language: Language, cases: CaseResult[]): JudgeResult {
  const priority: CaseStatus[] = ["CE", "IE", "RE", "MLE", "TLE", "WA"];
  const failed = cases.find((c) => !c.passed) ?? null;
  let verdict: Verdict = "AC";
  if (failed) {
    const present = new Set(cases.filter((c) => !c.passed).map((c) => c.status));
    const top = priority.find((p) => present.has(p)) ?? "WA";
    verdict = top === "IE" ? "RE" : top;
  }
  return {
    verdict,
    passed: cases.filter((c) => c.passed).length,
    total: cases.length,
    failedCase: failed,
    runtimeMs: Math.max(0, ...cases.map((c) => c.timeMs)),
    memoryKb: Math.max(0, ...cases.map((c) => c.memoryKb)),
    compileOutput: cases.find((c) => c.compileOutput)?.compileOutput ?? null,
    cases,
    language,
  };
}

/** Full judgement: sample + hidden tests, LeetCode-style verdict. */
export async function judgeSubmission(problem: JudgeProblem, language: Language, userCode: string): Promise<JudgeResult> {
  const all: CaseInput[] = [...problem.sampleTests, ...problem.hiddenTests].map((t) => ({ input: t.input, expected: t.expectedOutput }));
  const cases = await runCases(problem, language, userCode, all);
  return summarize(language, cases);
}

/** Same as judgeSubmission but for a reference solution (Module 02 uses it during generation). */
export async function verifyReference(problem: JudgeProblem, language: Language, referenceCode: string): Promise<JudgeResult> {
  return judgeSubmission(problem, language, referenceCode);
}

/** Strips anything that would reveal hidden tests: keeps only the first failed case. */
export function redactForClient(result: JudgeResult, visibleCount: number) {
  const { cases, ...rest } = result;
  const failed = result.failedCase;
  const failedCase = failed
    ? { index: failed.index, input: failed.input, expected: failed.expected ?? "", actual: failed.actual, stderr: failed.stderr, status: failed.status, hidden: failed.index >= visibleCount }
    : null;
  return { ...rest, failedCase };
}
