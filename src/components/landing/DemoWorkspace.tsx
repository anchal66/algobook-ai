"use client";
/**
 * Live demo (Module 05 U-10 §2.1): a read-only mini-workspace in the exact workspace look (page #1a1a1a / panel #262626,
 * 36 px tab bars) with a real editable editor and a real Run — JavaScript executed in a Web Worker against the sample
 * tests, no sign-in needed. No Monaco on the landing (bundle budget); a highlighted textarea editor instead.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileText, FlaskConical, Loader2, Play, SquareCode, Terminal, X } from "lucide-react";
import { DEMO_PROBLEM, WORKER_SRC, type DemoCaseResult } from "@/components/landing/demoProblem";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const TOKEN = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(function|return|const|let|var|for|if|else|new|of|in|while|true|false|null|undefined|typeof)\b|\b(twoSum|Map|has|get|set|slice|length)\b|\b(\d+)\b/g;
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** Single-pass tokenizer → highlighted HTML (comments, strings, keywords, identifiers, numbers). */
function highlight(src: string): string {
  let out = "", last = 0;
  for (const m of src.matchAll(TOKEN)) {
    out += esc(src.slice(last, m.index));
    const [tok, comment, str, kw, ident, num] = m;
    const cls = comment ? "text-[#6a9955]" : str ? "text-[#ce9178]" : kw ? "text-[#569cd6]" : ident ? "text-[#dcdcaa]" : num ? "text-[#b5cea8]" : "";
    out += cls ? `<span class="${cls}">${esc(tok)}</span>` : esc(tok);
    last = (m.index ?? 0) + tok.length;
  }
  return out + esc(src.slice(last));
}

export function DemoWorkspace() {
  const [code, setCode] = useState(DEMO_PROBLEM.starter);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DemoCaseResult[] | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [caseIdx, setCaseIdx] = useState(0);
  const [tab, setTab] = useState<"testcase" | "result">("testcase");
  const workerRef = useRef<Worker | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = useCallback(() => {
    setRunning(true); setCompileError(null); setResults(null); setTab("result");
    track("demo_run", { language: "javascript" });
    workerRef.current?.terminate();
    const blob = new Blob([WORKER_SRC], { type: "application/javascript" });
    const w = new Worker(URL.createObjectURL(blob));
    workerRef.current = w;
    const timeout = setTimeout(() => { w.terminate(); setResults(DEMO_PROBLEM.cases.map((c, i) => ({ index: i, status: "TLE", output: "", expected: JSON.stringify(c.expected), ms: 2000 }))); setRunning(false); }, 2000);
    w.onmessage = (e: MessageEvent<{ results?: DemoCaseResult[]; compileError?: string }>) => {
      clearTimeout(timeout);
      if (e.data.compileError) setCompileError(e.data.compileError); else setResults(e.data.results ?? []);
      setRunning(false);
    };
    w.postMessage({ code, cases: DEMO_PROBLEM.cases });
  }, [code]);

  const verdict = useMemo(() => {
    if (compileError) return { label: "Compile Error", cls: "text-err" };
    if (!results) return null;
    const passed = results.filter((r) => r.status === "AC").length;
    if (passed === results.length) return { label: "Accepted", cls: "text-accepted" };
    const first = results.find((r) => r.status !== "AC")!;
    return { label: first.status === "TLE" ? "Time Limit Exceeded" : first.status === "RE" ? "Runtime Error" : "Wrong Answer", cls: "text-wrong", sub: `${passed}/${results.length} testcases passed` };
  }, [results, compileError]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") { e.preventDefault(); const t = e.currentTarget; const s = t.selectionStart, en = t.selectionEnd; const next = code.slice(0, s) + "  " + code.slice(en); setCode(next); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; }); }
    if ((e.metaKey || e.ctrlKey) && e.key === "'") { e.preventDefault(); run(); }
  };

  return (
    <div className="ws-root dark overflow-hidden rounded-[14px] border border-white/10 bg-[#1a1a1a] text-[#f5f5f5] shadow-2xl" style={{ colorScheme: "dark" }}>
      {/* Top bar */}
      <div className="flex h-12 items-center justify-between gap-2 px-3">
        <div className="flex items-center gap-2 text-sm text-[#a3a3a3]"><span className="bg-brand flex size-6 items-center justify-center rounded-[6px]"><SquareCode className="size-3.5 text-white" /></span><span className="hidden sm:inline">Problem List</span></div>
        <div className="flex items-center gap-1 rounded-[8px] bg-[#262626] p-0.5">
          <button type="button" onClick={run} disabled={running} className="flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-sm font-medium text-[#f5f5f5] hover:bg-white/8 disabled:opacity-60">{running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run</button>
          <Link href="/login" className="flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-sm font-medium text-accepted hover:bg-white/8">Submit</Link>
        </div>
        <div className="hidden items-center gap-2 text-xs text-[#a3a3a3] sm:flex"><span className="rounded-[6px] bg-[#262626] px-2 py-1">⌘&apos; to run</span></div>
      </div>
      <div className="grid gap-2 px-[10px] pb-[10px] lg:grid-cols-2" style={{ minHeight: 520 }}>
        {/* Description */}
        <section className="flex min-h-[260px] flex-col overflow-hidden rounded-[8px] bg-[#262626]">
          <header className="flex h-9 items-center gap-2 border-b border-white/6 px-3 text-sm"><FileText className="size-4 text-[#1a90ff]" /><span className="font-medium">Description</span></header>
          <div className="ws-scroll flex-1 overflow-y-auto p-4 text-sm leading-6" style={{ maxHeight: 480 }}>
            <h3 className="text-lg font-semibold">{DEMO_PROBLEM.number}. {DEMO_PROBLEM.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-easy/15 px-2 py-0.5 text-easy">{DEMO_PROBLEM.difficulty}</span>
              {DEMO_PROBLEM.tags.map((t) => <span key={t} className="rounded-full bg-white/8 px-2 py-0.5 text-[#a3a3a3]">{t}</span>)}
            </div>
            {DEMO_PROBLEM.statement.map((p, i) => <p key={i} className="mt-3 text-[#d4d4d4]" dangerouslySetInnerHTML={{ __html: p.replace(/`([^`]+)`/g, '<code class="rounded bg-white/10 px-1 py-0.5 font-mono text-[13px]">$1</code>') }} />)}
            {DEMO_PROBLEM.examples.map((ex, i) => (
              <div key={i} className="mt-4"><p className="font-semibold">Example {i + 1}:</p><pre className="mt-1.5 whitespace-pre-wrap rounded-[8px] border-l-2 border-white/15 bg-white/4 px-3 py-2 font-mono text-[13px] text-[#d4d4d4]"><span className="text-[#a3a3a3]">Input:</span> {ex.input}{"\n"}<span className="text-[#a3a3a3]">Output:</span> {ex.output}{ex.explanation ? `\n` : ""}{ex.explanation && <><span className="text-[#a3a3a3]">Explanation:</span> {ex.explanation}</>}</pre></div>
            ))}
            <p className="mt-4 font-semibold">Constraints:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[#d4d4d4]">{DEMO_PROBLEM.constraints.map((c) => <li key={c}><code className="font-mono text-[13px]">{c}</code></li>)}</ul>
            <p className="mt-4 text-[#d4d4d4]"><span className="font-semibold">Follow-up:</span> {DEMO_PROBLEM.followUp}</p>
          </div>
        </section>
        <div className="flex min-h-[420px] flex-col gap-2">
          {/* Code */}
          <section className="flex flex-[65] flex-col overflow-hidden rounded-[8px] bg-[#262626]">
            <header className="flex h-9 items-center justify-between border-b border-white/6 px-3 text-sm"><span className="flex items-center gap-2"><SquareCode className="size-4 text-accepted" /><span className="font-medium">Code</span></span><span className="flex items-center gap-1 text-xs text-[#a3a3a3]">JavaScript <span className="rounded bg-white/8 px-1.5 py-0.5">Java · Python · C++ after sign-in</span></span></header>
            <div className="relative flex-1 bg-[#1e1e1e] font-mono text-[13px] leading-[20px]">
              <pre ref={preRef} aria-hidden className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-3 pl-10 text-[#d4d4d4]" dangerouslySetInnerHTML={{ __html: highlight(code) + "\n" }} />
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 select-none py-3 text-right text-[#6e7681]">{code.split("\n").map((_, i) => <div key={i} className="pr-1">{i + 1}</div>)}</div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={onKey}
                onScroll={(e) => { if (preRef.current) { preRef.current.scrollTop = e.currentTarget.scrollTop; preRef.current.scrollLeft = e.currentTarget.scrollLeft; } }}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="Code editor (JavaScript)"
                className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-3 pl-10 text-transparent caret-white outline-none selection:bg-[#264f78]"
              />
            </div>
          </section>
          {/* Console */}
          <section className="flex flex-[35] flex-col overflow-hidden rounded-[8px] bg-[#262626]">
            <header className="flex h-9 items-center gap-1 border-b border-white/6 px-2 text-sm">
              {(["testcase", "result"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={cn("flex h-7 items-center gap-1.5 rounded-[6px] px-2", tab === t ? "bg-white/8" : "text-[#a3a3a3] hover:text-white")}>{t === "testcase" ? <FlaskConical className="size-4 text-accepted" /> : <Terminal className="size-4 text-accepted" />}{t === "testcase" ? "Testcase" : "Test Result"}</button>)}
            </header>
            <div className="ws-scroll flex-1 overflow-y-auto p-3 text-sm" style={{ minHeight: 150 }}>
              {tab === "testcase" ? (
                <>
                  <div className="flex gap-1.5">{DEMO_PROBLEM.cases.map((_, i) => <button key={i} type="button" onClick={() => setCaseIdx(i)} className={cn("h-7 rounded-[6px] px-2.5 text-xs", caseIdx === i ? "bg-white/12" : "text-[#a3a3a3] hover:bg-white/6")}>Case {i + 1}</button>)}</div>
                  <p className="mt-3 text-xs text-[#a3a3a3]">nums =</p><pre className="mt-1 rounded-[8px] bg-white/6 px-3 py-1.5 font-mono text-[13px]">{JSON.stringify(DEMO_PROBLEM.cases[caseIdx].nums)}</pre>
                  <p className="mt-2 text-xs text-[#a3a3a3]">target =</p><pre className="mt-1 rounded-[8px] bg-white/6 px-3 py-1.5 font-mono text-[13px]">{DEMO_PROBLEM.cases[caseIdx].target}</pre>
                </>
              ) : running ? (
                <p className="flex items-center gap-2 text-[#a3a3a3]"><Loader2 className="size-4 animate-spin" /> Running 3 testcases…</p>
              ) : !verdict ? (
                <p className="text-[#a3a3a3]">Press <span className="rounded bg-white/8 px-1.5 py-0.5 text-xs">Run</span> to execute your code against the sample tests — right here in your browser.</p>
              ) : (
                <>
                  <p className={cn("text-lg font-semibold", verdict.cls)}>{verdict.label}{verdict.sub && <span className="ml-2 text-sm font-normal text-[#a3a3a3]">{verdict.sub}</span>}</p>
                  {compileError ? <pre className="mt-2 whitespace-pre-wrap rounded-[8px] bg-wrong/10 p-3 font-mono text-[13px] text-wrong">{compileError}</pre> : (
                    <>
                      <div className="mt-2 flex gap-1.5">{results!.map((r) => <button key={r.index} type="button" onClick={() => setCaseIdx(r.index)} className={cn("flex h-7 items-center gap-1 rounded-[6px] px-2.5 text-xs", caseIdx === r.index ? "bg-white/12" : "text-[#a3a3a3] hover:bg-white/6")}>{r.status === "AC" ? <Check className="size-3 text-accepted" /> : <X className="size-3 text-wrong" />}Case {r.index + 1}</button>)}</div>
                      {results![caseIdx] && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div><p className="text-xs text-[#a3a3a3]">Output</p><pre className="mt-1 rounded-[8px] bg-white/6 px-3 py-1.5 font-mono text-[13px]">{results![caseIdx].output || results![caseIdx].error || "—"}</pre></div>
                          <div><p className="text-xs text-[#a3a3a3]">Expected</p><pre className="mt-1 rounded-[8px] bg-white/6 px-3 py-1.5 font-mono text-[13px]">{results![caseIdx].expected}</pre></div>
                        </div>
                      )}
                      {verdict.label === "Accepted" && <p className="mt-3 text-sm text-[#a3a3a3]">Nice. <Link href="/login" className="text-brand-2 underline underline-offset-2">Sign in</Link> to submit against 14 hidden tests, see Beats %, and get an AI code review.</p>}
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/6 px-4 py-2 text-xs text-[#a3a3a3]">
        <span>Stuck? <button type="button" onClick={() => setCode(DEMO_PROBLEM.solution)} className="text-brand-2 underline underline-offset-2">Load the O(n) solution</button></span>
        <Button asChild size="xs" variant="brand"><Link href="/login">Open the full workspace</Link></Button>
      </div>
    </div>
  );
}
