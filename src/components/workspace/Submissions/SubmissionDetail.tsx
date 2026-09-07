"use client";
/** Submission detail (Module 03 §1.6 / W-13): verdict header, Beats bars, failed case, read-only code, load / compare. */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, GitCompare, Loader2, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getSubmission } from "@/lib/workspace/api";
import { useWorkspace } from "@/store/workspace";
import type { SubmissionDTO } from "@/lib/workspace/types";
import { BeatsBar } from "@/components/workspace/Console/SubmissionResultView";
import { CaseResultView, OutputBlock } from "@/components/workspace/Console/CaseResultView";
import { VERDICT_CLASS, VERDICT_LABEL, formatMemory } from "@/components/workspace/Console/verdict";
import { ConfirmDialog, LOAD_CODE_COPY } from "@/components/workspace/Overlays/ConfirmDialog";
import { replaceEditorValue } from "@/components/workspace/Code/editorRef";
import { EditorSkeleton } from "@/components/workspace/Code/MonacoEditor";

const MonacoEditor = dynamic(() => import("@/components/workspace/Code/MonacoEditor").then((m) => m.MonacoEditor), { ssr: false, loading: () => <EditorSkeleton /> });
const DiffView = dynamic(() => import("@/components/workspace/Submissions/DiffView").then((m) => m.DiffView), { ssr: false, loading: () => <EditorSkeleton /> });

const LANG_LABEL = { java: "Java", python: "Python3", cpp: "C++", javascript: "JavaScript" } as const;

export function SubmissionDetail({ id, onBack, onLoaded }: { id: string; onBack: () => void; onLoaded: (code: string) => void }) {
  const problem = useWorkspace((s) => s.problem);
  const currentCode = useWorkspace((s) => s.code[s.language] ?? "");
  const [sub, setSub] = useState<SubmissionDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [diff, setDiff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSubmission(id).then((r) => { if (!cancelled) setSub(r.submission); }).catch((e) => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <div className="p-4 text-sm text-wrong" role="alert">{error}</div>;
  if (!sub || !problem) return <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-fg-3" /></div>;
  const accepted = sub.verdict === "AC";

  const load = () => {
    if (!replaceEditorValue(sub.code)) onLoaded(sub.code);
    else onLoaded(sub.code);
  };

  return (
    <div className="ws-scroll flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2">
        <button type="button" onClick={onBack} className="flex h-7 items-center gap-1 rounded-[6px] px-2 text-xs text-fg-2 hover:bg-ws-hover hover:text-fg-1"><ArrowLeft className="size-3.5" /> All submissions</button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setDiff((d) => !d)} aria-pressed={diff} className={cn("flex h-7 items-center gap-1 rounded-[6px] px-2 text-xs hover:bg-ws-hover", diff ? "text-brand-to" : "text-fg-2 hover:text-fg-1")}><GitCompare className="size-3.5" /> Compare with current</button>
          <button type="button" onClick={() => setConfirm(true)} className="flex h-7 items-center gap-1 rounded-[6px] px-2 text-xs text-fg-2 hover:bg-ws-hover hover:text-fg-1"><Upload className="size-3.5" /> Load into editor</button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className={cn("text-lg font-semibold", VERDICT_CLASS[sub.verdict])}>{VERDICT_LABEL[sub.verdict]}</h2>
          <span className="text-xs text-fg-3">{sub.passed}/{sub.total} testcases passed · {LANG_LABEL[sub.language]} · {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}</span>
        </div>
        {accepted && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BeatsBar label="Runtime" value={`${sub.runtimeMs} ms`} beats={sub.beatsRuntimePct} />
            <BeatsBar label="Memory" value={formatMemory(sub.memoryKb)} beats={sub.beatsMemoryPct} />
          </div>
        )}
        {!accepted && sub.verdict === "CE" && sub.compileOutput && <div className="mt-3"><OutputBlock label="Compile output" value={sub.compileOutput} tone="error" /></div>}
        {!accepted && sub.verdict !== "CE" && sub.failedCase && (
          <div className="mt-3">
            <CaseResultView params={problem.params} hidden={sub.failedCase.hidden} result={{ index: sub.failedCase.index, status: sub.failedCase.status ?? sub.verdict, passed: false, input: sub.failedCase.input, expected: sub.failedCase.expected, actual: sub.failedCase.actual, stderr: sub.failedCase.stderr, compileOutput: null, timeMs: 0, memoryKb: 0 }} />
          </div>
        )}
        <div className="mt-4">
          <p className="mb-2 text-xs text-fg-3">{diff ? "Submission (left) vs current code (right)" : `Code · ${LANG_LABEL[sub.language]}`}</p>
          <div className="h-72">
            {diff ? <DiffView original={sub.code} modified={currentCode} language={sub.language} /> : (
              <div className="h-full overflow-hidden rounded-[8px] border border-line/70">
                <MonacoEditor value={sub.code} language={sub.language} onChange={() => undefined} vimStatusEl={null} readOnly />
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} description={LOAD_CODE_COPY} onConfirm={load} />
    </div>
  );
}
