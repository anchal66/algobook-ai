"use client";
/** AI editorial (Module 03 §1.4 / W-14): locked → reveal (records editorialViewed) → approaches with language tabs. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Copy, Loader2, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, getEditorial } from "@/lib/workspace/api";
import { track } from "@/lib/analytics";
import { useWorkspace } from "@/store/workspace";
import { isPro, useMe } from "@/store/me";
import type { EditorialDTO } from "@/lib/workspace/types";
import type { Language } from "@/types";
import { StatementMarkdown } from "@/components/workspace/Description/StatementMarkdown";

const LANG_LABEL: Record<Language, string> = { java: "Java", python: "Python3", cpp: "C++", javascript: "JavaScript" };
const LANG_ORDER: Language[] = ["java", "python", "cpp", "javascript"];

const cache = new Map<string, EditorialDTO>();

export function CodeBlockWithTabs({ code, initial }: { code: Partial<Record<Language, string>>; initial: Language }) {
  const langs = LANG_ORDER.filter((l) => code[l]);
  const [lang, setLang] = useState<Language>(langs.includes(initial) ? initial : (langs[0] ?? initial));
  const [copied, setCopied] = useState(false);
  if (!langs.length) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(code[lang] ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* ignore */ } };
  return (
    <div className="my-3 overflow-hidden rounded-[8px] border border-line/70">
      <div className="flex items-center gap-1 bg-ws-bar px-1 py-1">
        {langs.map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} className={cn("h-6 rounded-[5px] px-2 text-xs font-medium", l === lang ? "bg-ws-chip text-fg-1" : "text-fg-2 hover:text-fg-1")}>{LANG_LABEL[l]}</button>
        ))}
        <button type="button" onClick={() => void copy()} aria-label="Copy code" className="ml-auto flex size-6 items-center justify-center rounded-[5px] text-fg-3 hover:bg-ws-hover hover:text-fg-1">
          {copied ? <Check className="size-3.5 text-accepted" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="ws-scroll overflow-x-auto p-3 font-mono text-[13px] leading-relaxed text-fg-1">{code[lang]}</pre>
    </div>
  );
}

export function EditorialTab() {
  const problem = useWorkspace((s) => s.problem);
  const language = useWorkspace((s) => s.language);
  const editorialViewed = useWorkspace((s) => s.editorialViewed);
  const setEditorialViewed = useWorkspace((s) => s.setEditorialViewed);
  const submitted = useWorkspace((s) => s.submitState === "done");
  const me = useMe((s) => s.me);
  const bumpQuota = useMe((s) => s.bumpQuota);
  const pro = isPro(me);
  const [data, setData] = useState<EditorialDTO | null>(problem ? cache.get(problem.id) ?? null : null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const unlocked = editorialViewed || submitted;

  const load = useCallback(async () => {
    if (!problem) return;
    const cached = cache.get(problem.id);
    if (cached) { setData(cached); return; }
    setState("loading");
    setError(null);
    try {
      const res = await getEditorial(problem.id);
      cache.set(problem.id, res.editorial);
      setData(res.editorial);
      if (!res.cached) bumpQuota("editorial");
      track("editorial_view", { problemId: problem.id });
      setState("idle");
    } catch (e) {
      setState("error");
      setError(e instanceof ApiError ? (e.code === "PAYMENT_REQUIRED" ? "Editorials are part of the Pro plan." : e.code === "QUOTA_EXCEEDED" ? "You have used today's editorials." : e.message) : "Could not load the editorial");
    }
  }, [problem, bumpQuota]);

  useEffect(() => { if (unlocked && pro && !data && state === "idle" && !error) void load(); }, [unlocked, pro, data, state, error, load]);
  useEffect(() => { setData(problem ? cache.get(problem.id) ?? null : null); setError(null); setState("idle"); }, [problem?.id, problem]);

  if (!problem) return null;

  if (!unlocked || !pro) {
    return (
      <div className="relative h-full overflow-hidden">
        <div aria-hidden className="pointer-events-none select-none space-y-3 p-5 opacity-60 blur-[6px]">
          <div className="h-6 w-2/3 rounded bg-fg-1/20" />
          {[95, 88, 70, 92, 60, 85].map((w, i) => <div key={i} className="h-3.5 rounded bg-fg-1/15" style={{ width: `${w}%` }} />)}
          <div className="h-28 rounded-[8px] bg-fg-1/10" />
          {[80, 90, 65].map((w, i) => <div key={i} className="h-3.5 rounded bg-fg-1/15" style={{ width: `${w}%` }} />)}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-ws-chip"><Lock className="size-4 text-fg-2" /></span>
          <p className="text-sm font-medium text-fg-1">{pro ? "Editorial is locked until you submit" : "Editorials are a Pro feature"}</p>
          <p className="max-w-xs text-xs text-fg-3">{pro ? "Revealing it early is fine, but it lowers the mastery credit for this solve." : "Upgrade to unlock AI editorials, contextual hints, the tutor and inline completion."}</p>
          {pro ? (
            <button type="button" onClick={() => { setEditorialViewed(true); }} className="bg-brand flex h-9 items-center gap-1.5 rounded-[8px] px-4 text-sm font-medium text-white hover:opacity-90"><BookOpen className="size-4" /> Reveal editorial (affects mastery)</button>
          ) : (
            <Link href="/settings" className="bg-brand flex h-9 items-center gap-1.5 rounded-[8px] px-4 text-sm font-medium text-white hover:opacity-90"><Sparkles className="size-4" /> Upgrade to Pro</Link>
          )}
        </div>
      </div>
    );
  }

  if (state === "loading" || (!data && !error)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center" aria-busy="true">
        <Loader2 className="size-5 animate-spin text-brand-to" />
        <p className="text-sm text-fg-2">Writing the editorial…</p>
        <p className="text-xs text-fg-3">First time for this problem takes ~10 s; it is cached for everyone afterwards.</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-wrong" role="alert">{error}</p>
        <button type="button" onClick={() => void load()} className="h-8 rounded-[6px] bg-ws-chip px-3 text-xs text-fg-1 hover:bg-ws-hover">Retry</button>
      </div>
    );
  }

  return (
    <div className="ws-scroll h-full overflow-y-auto px-5 py-4">
      <div className="mb-4 flex items-center gap-2">
        <BookOpen className="size-4 text-fg-2" />
        <h2 className="text-base font-semibold text-fg-1">Editorial</h2>
        <span className="text-xs text-fg-3">AlgoBook AI · {data.model}</span>
      </div>
      {data.overview && <StatementMarkdown markdown={data.overview} className="mb-4" />}
      {data.approaches.map((a, i) => (
        <section key={i} className="mb-6">
          <h3 className="mb-2 text-base font-semibold text-fg-1">Approach {i + 1}: {a.title}</h3>
          <h4 className="mt-3 mb-1 text-sm font-semibold text-fg-1">Intuition</h4>
          <StatementMarkdown markdown={a.intuition} />
          <h4 className="mt-3 mb-1 text-sm font-semibold text-fg-1">Algorithm</h4>
          <StatementMarkdown markdown={a.algorithm} />
          <h4 className="mt-3 mb-1 text-sm font-semibold text-fg-1">Implementation</h4>
          <CodeBlockWithTabs code={a.code} initial={language} />
          <h4 className="mt-3 mb-1 text-sm font-semibold text-fg-1">Complexity Analysis</h4>
          <ul className="list-disc space-y-1 pl-6 text-sm text-fg-1/90">
            <li>Time complexity: <StatementMarkdown markdown={a.time} className="inline [&_p]:inline" /></li>
            <li>Space complexity: <StatementMarkdown markdown={a.space} className="inline [&_p]:inline" /></li>
          </ul>
        </section>
      ))}
      {data.pitfalls.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2 text-base font-semibold text-fg-1">Pitfalls</h3>
          <ul className="list-disc space-y-1 pl-6 text-sm text-fg-1/90">{data.pitfalls.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
