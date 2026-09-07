import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import { verifyReference } from "@/lib/judge/service";
import type { Language } from "@/lib/data/schema";

export const maxDuration = 120;

/**
 * `POST /api/admin/problems/:id/reverify` (Module 05 follow-up): re-runs every stored reference solution against the
 * sample + hidden tests on the judge, one language at a time. A language that no longer passes is disabled; when Java
 * itself fails the problem is retired. This is the operator's answer to "the AI got this one wrong": trust is re-earned
 * by execution, never by re-reading the statement.
 */
export const POST = handler({ evt: "admin.problems.reverify", admin: true }, async ({ params }) => {
  const p = await problems.resolve(params.id);
  if (!p) throw ApiError.notFound("Problem not found");
  const [tests, drivers] = await Promise.all([problems.getPrivateTests(p.id), problems.getDrivers(p.id)]);
  if (!tests || !drivers) throw ApiError.internal("Problem is missing private data");
  const results: { language: Language; verdict: string; passed: number; total: number; ok: boolean }[] = [];
  for (const language of p.languages) {
    const reference = tests.referenceSolution[language];
    const driver = drivers.drivers[language];
    if (!reference || !driver) { results.push({ language, verdict: "MISSING", passed: 0, total: 0, ok: false }); continue; }
    const r = await verifyReference({ id: p.id, checker: { type: p.checker.type, eps: p.checker.eps ?? undefined }, limits: p.limits, sampleTests: p.sampleTests, hiddenTests: tests.hiddenTests, drivers: { [language]: driver } }, language, reference);
    results.push({ language, verdict: r.verdict, passed: r.passed, total: r.total, ok: r.verdict === "AC" });
  }
  const failing = results.filter((r) => !r.ok).map((r) => r.language);
  const javaOk = results.find((r) => r.language === "java")?.ok ?? false;
  let action: "kept" | "languages_disabled" | "retired" = "kept";
  if (!javaOk) { await problems.setStatus(p.id, "retired"); action = "retired"; }
  else if (failing.length) { await problems.setLanguages(p.id, p.languages.filter((l) => !failing.includes(l))); action = "languages_disabled"; }
  return { id: p.id, title: p.title, results, action, disabled: javaOk ? failing : [] };
});
