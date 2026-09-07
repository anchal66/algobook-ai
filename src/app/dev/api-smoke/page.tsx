"use client";

/**
 * TEMPORARY admin-only page (Module 01 §3.11) that exercises /api/me,
 * /api/problems/:id, /api/run, /api/submit and /api/projects against the seeded
 * "two-sum" problem. Modules 03/05 replace every UI in this app; delete then.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api-client";
import { auth } from "@/lib/firebase";
import type { CaseResult, Language } from "@/types";

/** Reads a text/event-stream response and dispatches `{event, data}` pairs. */
async function readSse(res: Response, onEvent: (event: string, data: unknown) => void): Promise<void> {
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, (err?.code ?? "INTERNAL") as never, err?.message ?? `Request failed (${res.status})`);
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      let event = "message", data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (data) { try { onEvent(event, JSON.parse(data)); } catch { onEvent(event, data); } }
    }
  }
}

async function sseFetch(path: string, body: unknown, onEvent: (event: string, data: unknown) => void): Promise<void> {
  const token = await auth.currentUser!.getIdToken();
  const res = await fetch(path, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await readSse(res, onEvent);
}

type Lang = Language;
const LANGS: Lang[] = ["java", "python", "cpp", "javascript"];

const PRESETS: Record<Lang, Record<"correct" | "wrong" | "tle" | "ce", string>> = {
  java: {
    correct: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> seen = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            Integer j = seen.get(target - nums[i]);\n            if (j != null) return new int[]{j, i};\n            seen.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}`,
    wrong: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[]{0, 0};\n    }\n}`,
    tle: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        while (true) { }\n    }\n}`,
    ce: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        int x = "not an int";\n        return null;\n    }\n}`,
  },
  python: {
    correct: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        seen = {}\n        for i, x in enumerate(nums):\n            if target - x in seen:\n                return [seen[target - x], i]\n            seen[x] = i\n        return []`,
    wrong: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        return [0, 0]`,
    tle: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        while True:\n            pass`,
    ce: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        return [0, 1`,
  },
  cpp: {
    correct: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        unordered_map<int,int> seen;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            auto it = seen.find(target - nums[i]);\n            if (it != seen.end()) return {it->second, i};\n            seen[nums[i]] = i;\n        }\n        return {};\n    }\n};`,
    wrong: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        return {0, 0};\n    }\n};`,
    tle: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        while (true) {}\n        return {};\n    }\n};`,
    ce: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        int x = "not an int";\n        return {};\n    }\n};`,
  },
  javascript: {
    correct: `var twoSum = function(nums, target) {\n    const seen = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];\n        seen.set(nums[i], i);\n    }\n    return [];\n};`,
    wrong: `var twoSum = function(nums, target) {\n    return [0, 0];\n};`,
    tle: `var twoSum = function(nums, target) {\n    while (true) {}\n};`,
    ce: `var twoSum = function(nums, target) {\n    return [0, 1\n};`,
  },
};

interface Me { user: { uid: string; username: string; displayName: string }; plan: { tier: string; status: string }; isAdmin: boolean; quotas: { date: string; used: Record<string, number>; limits: Record<string, number>; resetAt: string } }
interface ProblemRes { problem: { id: string; title: string; difficulty: string; sampleTests: { input: string; expectedOutput: string }[]; starter: Record<string, string>; languages: string[] }; languages: { key: string; label: string; ready: boolean }[] }
interface SubmitRes { submission: { id: string; verdict: string; passed: number; total: number; runtimeMs: number; memoryKb: number; beatsRuntimePct: number | null; beatsMemoryPct: number | null; attemptNumber: number; isFirstTry: boolean; failedCase: { index: number; status: string; input: string; expected: string; actual: string; stderr: string; hidden: boolean } | null; compileOutput: string | null } }

function errText(e: unknown) {
  if (e instanceof ApiError) return `${e.status} ${e.code}: ${e.message}${e.details ? " " + JSON.stringify(e.details) : ""}`;
  return e instanceof Error ? e.message : String(e);
}

export default function ApiSmokePage() {
  const { user, loading } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problemId, setProblemId] = useState("two-sum");
  const [lang, setLang] = useState<Lang>("java");
  const [problem, setProblem] = useState<ProblemRes | null>(null);
  const [code, setCode] = useState("");
  const [custom, setCustom] = useState("3\n1 5 9\n14\n");
  const [runResult, setRunResult] = useState<CaseResult[] | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitRes["submission"] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [projectProbe, setProjectProbe] = useState("");
  const [probeOut, setProbeOut] = useState("");
  // ── Module 02 ──
  const [genProject, setGenProject] = useState("");
  const [genPrompt, setGenPrompt] = useState("medium sliding window");
  const [stages, setStages] = useState<string[]>([]);
  const [genOut, setGenOut] = useState<{ source: string; attempts: number; latencyMs: number; costUsd?: number; title?: string } | null>(null);
  const [aiOut, setAiOut] = useState<string>("");
  const [chatInput, setChatInput] = useState("why does my loop fail?");
  const [chatLog, setChatLog] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [langStatus, setLangStatus] = useState<Record<string, string>>({});

  const loadMe = useCallback(async () => {
    try { setMe(await apiFetch<Me>("/api/me")); setError(null); } catch (e) { setError(errText(e)); }
  }, []);

  useEffect(() => { if (user) loadMe(); }, [user, loadMe]);

  const loadProblem = async () => {
    setBusy("load"); setError(null);
    try {
      const res = await apiFetch<ProblemRes>(`/api/problems/${encodeURIComponent(problemId)}?lang=${lang}`);
      setProblem(res); setCode(res.problem.starter[lang] ?? ""); setRaw(JSON.stringify(res, null, 2));
    } catch (e) { setError(errText(e)); } finally { setBusy(null); }
  };

  const run = async () => {
    if (!problem) return;
    setBusy("run"); setError(null); setRunResult(null);
    try {
      const cases = [
        ...problem.problem.sampleTests.map((t) => ({ input: t.input, expected: t.expectedOutput })),
        ...(custom.trim() ? [{ input: custom }] : []),
      ];
      const res = await apiFetch<{ cases: CaseResult[] }>("/api/run", { method: "POST", body: { problemId: problem.problem.id, language: lang, code, cases } });
      setRunResult(res.cases); setRaw(JSON.stringify(res, null, 2)); loadMe();
    } catch (e) { setError(errText(e)); } finally { setBusy(null); }
  };

  const submit = async () => {
    if (!problem) return;
    setBusy("submit"); setError(null); setSubmitResult(null);
    try {
      const res = await apiFetch<SubmitRes>("/api/submit", { method: "POST", body: { problemId: problem.problem.id, language: lang, code, meta: { hintsUsed: 0, editorialViewed: false, timeSpentSec: 42, runCount: 1 } } });
      setSubmitResult(res.submission); setRaw(JSON.stringify(res, null, 2)); loadMe();
    } catch (e) { setError(errText(e)); } finally { setBusy(null); }
  };

  const probe = async (path: string) => {
    setBusy("probe");
    try { const res = await apiFetch(path); setProbeOut(`200 OK\n${JSON.stringify(res, null, 2).slice(0, 2000)}`); }
    catch (e) { setProbeOut(errText(e)); } finally { setBusy(null); }
  };

  // ── Module 02 actions ──
  const ensureProject = async (): Promise<string> => {
    if (genProject) return genProject;
    const res = await apiFetch<{ project: { id: string } }>("/api/projects", { method: "POST", body: { title: "AI smoke project", description: "Module 02 smoke", selectedTopics: [] } });
    setGenProject(res.project.id);
    return res.project.id;
  };

  const generateNext = async () => {
    setBusy("generate"); setError(null); setStages([]); setGenOut(null);
    try {
      const pid = await ensureProject();
      const t0 = Date.now();
      await sseFetch(`/api/projects/${pid}/next?stream=1`, { userPrompt: genPrompt || undefined, language: lang }, (event, data) => {
        const d = data as Record<string, unknown>;
        if (event === "stage") setStages((s) => [...s, `${((Date.now() - t0) / 1000).toFixed(1)}s ${d.stage}${d.round !== undefined ? ` r${d.round}` : ""}${d.model ? ` ${d.model}` : ""}${d.source ? ` (${d.source})` : ""}`]);
        else if (event === "done") {
          const r = d as { source: string; attempts: number; latencyMs: number; costUsd?: number; problem: { id: string; title: string } };
          setGenOut({ source: r.source, attempts: r.attempts, latencyMs: r.latencyMs, costUsd: r.costUsd, title: r.problem.title });
          setProblemId(r.problem.id); setRaw(JSON.stringify(d, null, 2));
        } else if (event === "error") { const e = d as { message: string; code: string }; setError(`${e.code}: ${e.message}`); }
      });
      loadMe();
    } catch (e) { setError(errText(e)); } finally { setBusy(null); }
  };

  const ensureLang = async (l: Lang) => {
    if (!problem) return;
    setLangStatus((s) => ({ ...s, [l]: "Preparing…" }));
    try {
      const res = await apiFetch<{ status: string; starter: string | null }>(`/api/problems/${problem.problem.id}/languages`, { method: "POST", body: { language: l, wait: true } });
      setLangStatus((s) => ({ ...s, [l]: res.status }));
      if (res.status === "ready") await loadProblem();
    } catch (e) { setLangStatus((s) => ({ ...s, [l]: errText(e).slice(0, 80) })); }
  };

  const hint = async (level: 1 | 2 | 3) => {
    if (!problem) return;
    setBusy("hint"); setAiOut("");
    try {
      const res = await apiFetch<{ label: string; text: string; source: string; costUsd?: number }>(`/api/problems/${problem.problem.id}/hints`, { method: "POST", body: { level, code: level === 3 ? code : undefined, language: lang } });
      setAiOut(`Hint ${level} · ${res.label} (${res.source}${res.costUsd !== undefined ? `, $${res.costUsd.toFixed(4)}` : ""})\n\n${res.text}`); loadMe();
    } catch (e) { setAiOut(errText(e)); } finally { setBusy(null); }
  };

  const editorial = async () => {
    if (!problem) return;
    setBusy("editorial"); setAiOut("");
    const t0 = Date.now();
    try {
      const res = await apiFetch<{ editorial: { overview: string; approaches: { title: string; time: string; space: string; code: Record<string, string> }[]; pitfalls: string[] }; cached: boolean }>(`/api/problems/${problem.problem.id}/editorial`);
      setAiOut(`Editorial (${res.cached ? "cached" : "generated"}, ${Date.now() - t0} ms)\n\n${res.editorial.overview}\n\n${res.editorial.approaches.map((a, i) => `${i + 1}. ${a.title} — ${a.time} / ${a.space}\n${a.code.java?.slice(0, 400) ?? ""}`).join("\n\n")}\n\nPitfalls: ${res.editorial.pitfalls.join(" | ")}`); loadMe();
    } catch (e) { setAiOut(errText(e)); } finally { setBusy(null); }
  };

  const explain = async () => {
    if (!problem) return;
    const output = submitResult?.compileOutput || submitResult?.failedCase?.stderr || runResult?.find((c) => c.compileOutput || c.stderr)?.compileOutput || "";
    if (!output) { setAiOut("Submit or run something that fails first (compile error / runtime error)."); return; }
    setBusy("explain"); setAiOut("");
    try {
      const res = await apiFetch<{ explanation: string }>(`/api/problems/${problem.problem.id}/explain-error`, { method: "POST", body: { language: lang, code, output } });
      setAiOut(`Explain error:\n\n${res.explanation}`); loadMe();
    } catch (e) { setAiOut(errText(e)); } finally { setBusy(null); }
  };

  const review = async () => {
    if (!problem || !submitResult) return;
    setBusy("review"); setAiOut("");
    try {
      const res = await apiFetch<{ review: Record<string, unknown>; cached: boolean }>(`/api/problems/${problem.problem.id}/review`, { method: "POST", body: { submissionId: submitResult.id } });
      setAiOut(`Review (${res.cached ? "cached" : "generated"}):\n${JSON.stringify(res.review, null, 2)}`); loadMe();
    } catch (e) { setAiOut(errText(e)); } finally { setBusy(null); }
  };

  const chat = async () => {
    if (!problem || !chatInput.trim()) return;
    const turns = [...chatLog, { role: "user" as const, content: chatInput }];
    setChatLog([...turns, { role: "assistant", content: "" }]); setChatInput(""); setBusy("chat");
    try {
      await sseFetch(`/api/problems/${problem.problem.id}/chat`, { messages: turns.slice(-8), code, language: lang }, (event, data) => {
        if (event === "delta") setChatLog((l) => { const c = [...l]; c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + (data as { text: string }).text }; return c; });
        else if (event === "error") setChatLog((l) => [...l, { role: "assistant", content: `⚠ ${(data as { message: string }).message}` }]);
      });
      loadMe();
    } catch (e) { setChatLog((l) => [...l, { role: "assistant", content: `⚠ ${errText(e)}` }]); } finally { setBusy(null); }
  };

  const complete = async () => {
    setBusy("complete"); setAiOut("");
    const t0 = Date.now();
    try {
      const res = await apiFetch<{ text: string }>("/api/ai/complete", { method: "POST", body: { language: lang, prefix: code, suffix: "", problemId: problem?.problem.id } });
      setAiOut(`Completion (${Date.now() - t0} ms):\n${JSON.stringify(res.text)}`); loadMe();
    } catch (e) { setAiOut(errText(e)); } finally { setBusy(null); }
  };

  const insights = async () => {
    setBusy("insights"); setAiOut("");
    try {
      const pid = await ensureProject();
      const res = await apiFetch<{ insights: Record<string, unknown>; cached: boolean }>(`/api/projects/${pid}/insights`, { method: "POST", body: {} });
      setAiOut(`Insights (${res.cached ? "cached" : "generated"}):\n${JSON.stringify(res.insights, null, 2)}`);
    } catch (e) { setAiOut(errText(e)); } finally { setBusy(null); }
  };

  if (loading) return <div className="p-8 font-mono text-sm">Loading auth…</div>;
  if (!user) return <div className="p-8 font-mono text-sm">Sign in first (<Link className="underline" href="/login">/login</Link>).</div>;
  if (me && !me.isAdmin) return <div className="p-8 font-mono text-sm">Admin only. Add your uid ({me.user.uid}) to ADMIN_UIDS.</div>;

  const verdictColor = (v: string) => (v === "AC" ? "text-emerald-400" : v === "CE" ? "text-amber-400" : "text-red-400");

  return (
    <div className="mx-auto max-w-6xl p-6 font-mono text-sm space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <h1 className="text-lg font-bold">/dev/api-smoke — Modules 01 + 02</h1>
        {me && (
          <div className="text-xs text-muted-foreground">
            uid <b>{me.user.uid}</b> · @{me.user.username} · plan <b>{me.plan.tier}</b> ({me.plan.status}) · quotas {me.quotas.date}: run {me.quotas.used.run ?? 0}/{me.quotas.limits.run}, submit {me.quotas.used.submit ?? 0}/{me.quotas.limits.submit}
          </div>
        )}
      </header>

      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-red-300 whitespace-pre-wrap">{error}</div>}

      <section className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
        <label className="grid gap-1">Problem id or slug
          <input className="rounded border border-border bg-background px-2 py-1" value={problemId} onChange={(e) => setProblemId(e.target.value)} />
        </label>
        <label className="grid gap-1">Language
          <select className="rounded border border-border bg-background px-2 py-1" value={lang} onChange={(e) => { const l = e.target.value as Lang; setLang(l); if (problem) setCode(problem.problem.starter[l] ?? ""); }}>
            {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <button className="rounded bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50" disabled={busy !== null} onClick={loadProblem}>{busy === "load" ? "Loading…" : "Load problem"}</button>
      </section>

      {problem && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div><b>{problem.problem.title}</b> · {problem.problem.difficulty} · languages ready: {problem.languages.filter((l) => l.ready).map((l) => l.key).join(", ")}</div>
            <div className="flex flex-wrap gap-2">
              {(["correct", "wrong", "tle", "ce"] as const).map((k) => (
                <button key={k} className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={() => setCode(PRESETS[lang][k])}>{k.toUpperCase()}</button>
              ))}
              <button className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={() => setCode(problem.problem.starter[lang] ?? "")}>STARTER</button>
            </div>
            <textarea className="h-72 w-full rounded border border-border bg-background p-2" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
            <label className="grid gap-1">Custom test input (stdin format, no expected output)
              <textarea className="h-20 w-full rounded border border-border bg-background p-2" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button className="rounded bg-emerald-600 px-3 py-1.5 text-white disabled:opacity-50" disabled={busy !== null} onClick={run}>{busy === "run" ? "Running…" : `Run (${problem.problem.sampleTests.length} sample + custom)`}</button>
              <button className="rounded bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-50" disabled={busy !== null} onClick={submit}>{busy === "submit" ? "Judging…" : "Submit"}</button>
            </div>
          </div>

          <div className="space-y-3">
            {runResult && (
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th>#</th><th>status</th><th>expected</th><th>actual</th><th>ms</th><th>KB</th></tr></thead>
                <tbody>
                  {runResult.map((c) => (
                    <tr key={c.index} className="border-t border-border align-top">
                      <td>{c.index}</td>
                      <td className={verdictColor(c.status)}>{c.status}</td>
                      <td className="whitespace-pre">{c.expected ?? "—"}</td>
                      <td className="whitespace-pre">{c.actual || (c.compileOutput ? c.compileOutput.slice(0, 300) : c.stderr.slice(0, 300))}</td>
                      <td>{c.timeMs}</td><td>{c.memoryKb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {submitResult && (
              <div className="rounded border border-border p-3 space-y-1">
                <div className={`text-base font-bold ${verdictColor(submitResult.verdict)}`}>{submitResult.verdict === "AC" ? "Accepted" : submitResult.verdict === "WA" ? "Wrong Answer" : submitResult.verdict === "TLE" ? "Time Limit Exceeded" : submitResult.verdict === "CE" ? "Compile Error" : submitResult.verdict === "RE" ? "Runtime Error" : submitResult.verdict}</div>
                <div>{submitResult.passed}/{submitResult.total} testcases passed · attempt #{submitResult.attemptNumber}{submitResult.isFirstTry ? " · first try" : ""}</div>
                {submitResult.verdict === "AC" && <div>Runtime {submitResult.runtimeMs} ms · beats {submitResult.beatsRuntimePct}% · Memory {submitResult.memoryKb} KB · beats {submitResult.beatsMemoryPct}%</div>}
                {submitResult.compileOutput && <pre className="whitespace-pre-wrap text-amber-300">{submitResult.compileOutput.slice(0, 1500)}</pre>}
                {submitResult.failedCase && (
                  <div className="text-xs">
                    <div>failed case #{submitResult.failedCase.index} {submitResult.failedCase.hidden ? "(hidden)" : "(sample)"} · {submitResult.failedCase.status}</div>
                    <div>input: <pre className="inline whitespace-pre">{submitResult.failedCase.input}</pre></div>
                    <div>expected: <span className="whitespace-pre">{submitResult.failedCase.expected}</span> · actual: <span className="whitespace-pre">{submitResult.failedCase.actual || "∅"}</span></div>
                    {submitResult.failedCase.stderr && <pre className="whitespace-pre-wrap text-red-300">{submitResult.failedCase.stderr.slice(0, 800)}</pre>}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3 border-t border-border pt-4">
        <div className="font-bold">Module 02 — AI engine</div>
        <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto] items-end">
          <label className="grid gap-1">Project id (blank = create one)
            <input className="rounded border border-border bg-background px-2 py-1" value={genProject} onChange={(e) => setGenProject(e.target.value)} />
          </label>
          <label className="grid gap-1">Prompt (topic preference)
            <input className="rounded border border-border bg-background px-2 py-1" value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} />
          </label>
          <button className="rounded bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-50" disabled={busy !== null} onClick={generateNext}>{busy === "generate" ? "Generating…" : "Generate next (stream)"}</button>
        </div>
        {(stages.length > 0 || genOut) && (
          <div className="rounded border border-border p-2 text-xs space-y-1">
            <div className="flex flex-wrap gap-2">{stages.map((s, i) => <span key={i} className="rounded bg-muted px-2 py-0.5">{s}</span>)}</div>
            {genOut && <div><b>{genOut.title}</b> · source <b className={genOut.source === "reused" ? "text-emerald-400" : "text-indigo-300"}>{genOut.source}</b> · attempts {genOut.attempts} · {genOut.latencyMs} ms{genOut.costUsd !== undefined ? ` · $${genOut.costUsd.toFixed(4)}` : ""}</div>}
          </div>
        )}
        {problem && (
          <div className="flex flex-wrap items-center gap-2">
            <span>Languages:</span>
            {LANGS.map((l) => {
              const ready = problem.languages.find((x) => x.key === l)?.ready;
              return <button key={l} className={`rounded border px-2 py-1 ${ready ? "border-emerald-500/50 text-emerald-300" : "border-border hover:bg-muted"}`} onClick={() => ensureLang(l)}>{l}: {ready ? "ready" : langStatus[l] ?? "ensure"}</button>;
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50" disabled={!problem || busy !== null} onClick={() => hint(1)}>Hint 1</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50" disabled={!problem || busy !== null} onClick={() => hint(2)}>Hint 2</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50" disabled={!problem || busy !== null} onClick={() => hint(3)}>Hint 3 (uses code)</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50" disabled={!problem || busy !== null} onClick={editorial}>Editorial</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50" disabled={!problem || busy !== null} onClick={explain}>Explain error</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50" disabled={!submitResult || busy !== null} onClick={review}>Review last submission</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50" disabled={busy !== null} onClick={complete}>Complete (ghost text)</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50" disabled={busy !== null} onClick={insights}>Project insights</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={() => probe("/api/admin/ai-usage")}>GET /api/admin/ai-usage</button>
        </div>
        {aiOut && <pre className="max-h-80 overflow-auto rounded border border-border p-2 text-xs whitespace-pre-wrap">{aiOut}</pre>}
        <div className="grid gap-2 md:grid-cols-[1fr_auto] items-end">
          <label className="grid gap-1">Tutor chat
            <input className="rounded border border-border bg-background px-2 py-1" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") chat(); }} />
          </label>
          <button className="rounded border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50" disabled={!problem || busy !== null} onClick={chat}>{busy === "chat" ? "Streaming…" : "Send"}</button>
        </div>
        {chatLog.length > 0 && (
          <div className="max-h-72 overflow-auto rounded border border-border p-2 text-xs space-y-2">
            {chatLog.map((m, i) => <div key={i} className={m.role === "user" ? "text-indigo-300" : ""}><b>{m.role}:</b> <span className="whitespace-pre-wrap">{m.content}</span></div>)}
          </div>
        )}
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <div className="font-bold">Probes</div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={() => probe("/api/me")}>GET /api/me</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={() => probe("/api/projects")}>GET /api/projects</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={() => probe("/api/templates")}>GET /api/templates</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={() => probe("/api/submissions?limit=5")}>GET /api/submissions</button>
          <button className="rounded border border-border px-2 py-1 hover:bg-muted" onClick={() => probe("/api/activity")}>GET /api/activity</button>
          <input className="rounded border border-border bg-background px-2 py-1" placeholder="project id (someone else's → 404)" value={projectProbe} onChange={(e) => setProjectProbe(e.target.value)} />
          <button className="rounded border border-border px-2 py-1 hover:bg-muted" disabled={!projectProbe} onClick={() => probe(`/api/projects/${encodeURIComponent(projectProbe)}`)}>GET /api/projects/:id</button>
        </div>
        {probeOut && <pre className="max-h-64 overflow-auto rounded border border-border p-2 text-xs whitespace-pre-wrap">{probeOut}</pre>}
      </section>

      {raw && (
        <details className="border-t border-border pt-4">
          <summary className="cursor-pointer">Last raw response</summary>
          <pre className="max-h-96 overflow-auto text-xs">{raw}</pre>
        </details>
      )}
    </div>
  );
}
