"use client";
/**
 * Solutions tab (Module 03 §1.5 / W-15, D-15): AlgoBook reference solutions (editorial code per language,
 * visible after AC or an editorial reveal) + the user's own accepted submissions. Load-into-editor confirms.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Search, Sparkles, Upload, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ApiError, getEditorial, getSubmission, listSubmissions } from "@/lib/workspace/api";
import { useWorkspace } from "@/store/workspace";
import { isPro, useMe } from "@/store/me";
import type { EditorialDTO, SubmissionListItem } from "@/lib/workspace/types";
import type { Language } from "@/types";
import { CodeBlockWithTabs } from "@/components/workspace/Editorial/EditorialTab";
import { ConfirmDialog, LOAD_CODE_COPY } from "@/components/workspace/Overlays/ConfirmDialog";
import { replaceEditorValue } from "@/components/workspace/Code/editorRef";

const LANG_LABEL: Record<Language, string> = { java: "Java", python: "Python3", cpp: "C++", javascript: "JavaScript" };
const LANGS: Language[] = ["java", "python", "cpp", "javascript"];

export function SolutionsTab({ onLoadCode }: { onLoadCode: (code: string) => void }) {
  const problem = useWorkspace((s) => s.problem);
  const language = useWorkspace((s) => s.language);
  const editorialViewed = useWorkspace((s) => s.editorialViewed);
  const submitResult = useWorkspace((s) => s.submitResult);
  const submittedAt = useWorkspace((s) => s.submittedAt);
  const items = useWorkspace((s) => s.items);
  const pro = isPro(useMe((s) => s.me));
  const solved = editorialViewed || submitResult?.submission.verdict === "AC" || items.some((i) => i.problemId === problem?.id && i.status === "solved");
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<Language | "all">("all");
  const [editorial, setEditorial] = useState<EditorialDTO | null>(null);
  const [edError, setEdError] = useState<string | null>(null);
  const [mine, setMine] = useState<SubmissionListItem[]>([]);
  const [pending, setPending] = useState<{ code: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!problem || !solved || !pro) return;
    let cancelled = false;
    getEditorial(problem.id).then((r) => { if (!cancelled) setEditorial(r.editorial); }).catch((e) => { if (!cancelled) setEdError(e instanceof ApiError ? e.message : "Unavailable"); });
    return () => { cancelled = true; };
  }, [problem, solved, pro]);

  useEffect(() => {
    if (!problem) return;
    let cancelled = false;
    listSubmissions(problem.id).then((r) => { if (!cancelled) setMine(r.items.filter((s) => s.verdict === "AC")); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [problem, submittedAt]);

  const filteredMine = useMemo(() => mine.filter((s) => lang === "all" || s.language === lang), [mine, lang]);
  const refs = useMemo(() => {
    if (!editorial) return [];
    return editorial.approaches.map((a, i) => ({ title: a.title, code: a.code, i })).filter((a) => (lang === "all" ? true : !!a.code[lang]) && (q ? a.title.toLowerCase().includes(q.toLowerCase()) : true));
  }, [editorial, lang, q]);

  const openMine = async (id: string) => {
    setOpening(id);
    try { const r = await getSubmission(id); setPending({ code: r.submission.code }); } finally { setOpening(null); }
  };
  const load = () => { if (!pending) return; if (!replaceEditorValue(pending.code)) onLoadCode(pending.code); else onLoadCode(pending.code); };

  if (!problem) return null;
  return (
    <div className="ws-scroll h-full overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-8 flex-1 items-center gap-2 rounded-[8px] bg-fg-1/[0.07] px-2.5 text-sm">
          <Search className="size-4 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search solutions" className="w-full bg-transparent text-fg-1 outline-none placeholder:text-fg-3" />
        </label>
        <div className="flex items-center gap-1">
          {(["all", ...LANGS] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} className={cn("h-7 rounded-full px-2.5 text-xs", lang === l ? "bg-ws-chip text-fg-1" : "text-fg-2 hover:bg-ws-hover")}>{l === "all" ? "All" : LANG_LABEL[l]}</button>
          ))}
        </div>
      </div>

      {!solved ? (
        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-ws-chip"><Lock className="size-4 text-fg-2" /></span>
          <p className="text-sm font-medium text-fg-1">Solve it first</p>
          <p className="max-w-xs text-xs text-fg-3">Reference solutions unlock after your first Accepted submission (or when you reveal the editorial).</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {!pro && <p className="rounded-[8px] bg-ws-bar px-3 py-2 text-xs text-fg-2">AlgoBook reference solutions are a Pro feature. Your own accepted submissions are listed below.</p>}
          {edError && <p className="text-xs text-wrong">{edError}</p>}
          {pro && !editorial && !edError && <div className="flex items-center gap-2 text-xs text-fg-3"><Loader2 className="size-3.5 animate-spin" /> Loading reference solutions…</div>}
          {refs.map((r) => (
            <details key={r.i} className="group rounded-[8px] border border-line/70" open={r.i === 0}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
                <Sparkles className="size-4 text-brand-to" />
                <span className="font-medium text-fg-1">AlgoBook Reference — {r.title}</span>
                <span className="ml-auto text-xs text-fg-3">{LANGS.filter((l) => r.code[l]).map((l) => LANG_LABEL[l]).join(" · ")}</span>
              </summary>
              <div className="px-3 pb-3">
                <CodeBlockWithTabs code={r.code} initial={lang === "all" ? language : lang} />
                {r.code[lang === "all" ? language : lang] && (
                  <button type="button" onClick={() => setPending({ code: r.code[lang === "all" ? language : lang]! })} className="flex h-8 items-center gap-1.5 rounded-[6px] bg-ws-chip px-3 text-xs font-medium text-fg-1 hover:bg-ws-hover"><Upload className="size-3.5" /> Load into editor</button>
                )}
              </div>
            </details>
          ))}
          {filteredMine.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-[8px] border border-line/70 px-3 py-2 text-sm">
              <User className="size-4 text-fg-2" />
              <span className="font-medium text-fg-1">Your solution</span>
              <span className="text-xs text-fg-3">{LANG_LABEL[s.language]} · Beats {s.beatsRuntimePct ?? 0}% · {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}</span>
              <button type="button" onClick={() => void openMine(s.id)} disabled={opening === s.id} className="ml-auto flex h-7 items-center gap-1 rounded-[6px] bg-ws-chip px-2.5 text-xs text-fg-1 hover:bg-ws-hover disabled:opacity-60">
                {opening === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Load
              </button>
            </div>
          ))}
          {solved && !refs.length && !filteredMine.length && editorial && <p className="text-xs text-fg-3">No solutions match this filter.</p>}
        </div>
      )}
      <ConfirmDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }} description={LOAD_CODE_COPY} onConfirm={load} />
    </div>
  );
}
