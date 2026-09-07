"use client";
/** Submissions tab (Module 03 §1.6 / W-13): status + time · language · runtime · memory; click → detail. */
import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { listSubmissions } from "@/lib/workspace/api";
import { useWorkspace } from "@/store/workspace";
import type { SubmissionListItem } from "@/lib/workspace/types";
import { SubmissionDetail } from "@/components/workspace/Submissions/SubmissionDetail";
import { VERDICT_CLASS, VERDICT_LABEL, formatMemory } from "@/components/workspace/Console/verdict";

const LANG_LABEL = { java: "Java", python: "Python3", cpp: "C++", javascript: "JavaScript" } as const;

export function SubmissionsTab({ onLoadCode }: { onLoadCode: (code: string) => void }) {
  const problem = useWorkspace((s) => s.problem);
  const submittedAt = useWorkspace((s) => s.submittedAt);
  const setUi = useWorkspace((s) => s.setUi);
  const [items, setItems] = useState<SubmissionListItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async (append = false) => {
    if (!problem) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listSubmissions(problem.id, append ? cursor ?? undefined : undefined);
      setItems((prev) => (append && prev ? [...prev, ...res.items] : res.items));
      setCursor(res.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [problem, cursor]);

  useEffect(() => { setSelected(null); setItems(null); void load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [problem?.id, submittedAt]);

  if (!problem) return null;
  if (selected) return <SubmissionDetail id={selected} onBack={() => setSelected(null)} onLoaded={onLoadCode} />;

  if (items === null) {
    return <div className="space-y-2 p-4" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="ws-shimmer h-10 rounded-[6px]" />)}</div>;
  }
  if (error) return <div className="p-4 text-sm text-wrong" role="alert">{error}</div>;
  if (!items.length) {
    return <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center"><p className="text-sm text-fg-1">No submissions yet</p><p className="text-xs text-fg-3">Submit your solution to see it here.</p></div>;
  }

  return (
    <div className="ws-scroll h-full overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-ws-panel text-left text-xs text-fg-3">
          <tr><th className="px-4 py-2 font-medium">Status</th><th className="px-2 py-2 font-medium">Language</th><th className="px-2 py-2 font-medium">Runtime</th><th className="px-2 py-2 font-medium">Memory</th><th className="w-8" /></tr>
        </thead>
        <tbody>
          {items.map((s, i) => (
            <tr key={s.id} onClick={() => setSelected(s.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(s.id); } }} className={cn("cursor-pointer transition-colors hover:bg-ws-hover focus:outline-none focus-visible:bg-ws-hover", i % 2 === 1 && "bg-fg-1/[0.02]")}>
              <td className="px-4 py-2">
                <p className={cn("font-medium", VERDICT_CLASS[s.verdict])}>{VERDICT_LABEL[s.verdict]}</p>
                <p className="text-[11px] text-fg-3">{formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}</p>
              </td>
              <td className="px-2 py-2"><span className="rounded-full bg-ws-chip px-2 py-0.5 text-xs text-fg-1">{LANG_LABEL[s.language]}</span></td>
              <td className="px-2 py-2 font-mono text-xs text-fg-2">{s.verdict === "AC" ? `${s.runtimeMs} ms` : "N/A"}</td>
              <td className="px-2 py-2 font-mono text-xs text-fg-2">{s.verdict === "AC" ? formatMemory(s.memoryKb) : "N/A"}</td>
              <td className="px-2 py-2 text-fg-3">
                <button type="button" aria-label="Open notes" onClick={(e) => { e.stopPropagation(); setUi({ sidePanel: "notes" }); }} className="flex size-6 items-center justify-center rounded-[5px] hover:bg-ws-hover hover:text-fg-1"><NotebookPen className="size-3.5" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cursor && (
        <div className="p-3 text-center">
          <button type="button" onClick={() => void load(true)} disabled={loading} className="h-8 rounded-[6px] bg-ws-chip px-3 text-xs text-fg-1 hover:bg-ws-hover disabled:opacity-60">{loading ? <Loader2 className="size-3.5 animate-spin" /> : "Load more"}</button>
        </div>
      )}
    </div>
  );
}
