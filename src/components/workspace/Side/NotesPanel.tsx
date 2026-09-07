"use client";
/** Notes side panel (Module 03 W-19): markdown textarea + preview toggle, saved to notes/{uid}_{problemId} (1.5 s debounce). */
import { useEffect, useRef, useState } from "react";
import { Eye, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNote, putNote } from "@/lib/workspace/api";
import { useWorkspace } from "@/store/workspace";
import { StatementMarkdown } from "@/components/workspace/Description/StatementMarkdown";

export function NotesPanel() {
  const problem = useWorkspace((s) => s.problem);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<"loading" | "saved" | "saving" | "unsaved" | "error">("loading");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const problemId = problem?.id;

  useEffect(() => {
    if (!problemId) return;
    let cancelled = false;
    setStatus("loading");
    getNote(problemId).then((r) => { if (!cancelled) { setText(r.note?.markdown ?? ""); setStatus("saved"); } }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, [problemId]);

  const onChange = (v: string) => {
    setText(v);
    setStatus("unsaved");
    if (!problemId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      try { await putNote(problemId, v); setStatus("saved"); } catch { setStatus("error"); }
    }, 1500);
  };

  if (!problem) return <p className="p-4 text-sm text-fg-3">Open a problem to take notes.</p>;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-fg-3">
        <span>{status === "loading" ? "Loading…" : status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Could not save" : "Unsaved"}</span>
        <span className="ml-auto flex items-center rounded-[6px] bg-ws-chip p-0.5">
          <button type="button" onClick={() => setPreview(false)} aria-pressed={!preview} className={cn("flex h-6 items-center gap-1 rounded-[5px] px-2", !preview ? "bg-ws-panel text-fg-1" : "text-fg-2")}><Pencil className="size-3" /> Edit</button>
          <button type="button" onClick={() => setPreview(true)} aria-pressed={preview} className={cn("flex h-6 items-center gap-1 rounded-[5px] px-2", preview ? "bg-ws-panel text-fg-1" : "text-fg-2")}><Eye className="size-3" /> Preview</button>
        </span>
      </div>
      {status === "loading" ? (
        <div className="flex flex-1 items-center justify-center"><Loader2 className="size-5 animate-spin text-fg-3" /></div>
      ) : preview ? (
        <div className="ws-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">{text.trim() ? <StatementMarkdown markdown={text} /> : <p className="text-sm text-fg-3">Nothing yet — switch to Edit to write notes in Markdown.</p>}</div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"Your notes for this problem (Markdown supported)\n\n- key insight\n- edge cases"}
          spellCheck={false}
          className="ws-scroll min-h-0 flex-1 resize-none bg-transparent px-4 pb-4 font-mono text-[13px] leading-6 text-fg-1 outline-none placeholder:text-fg-3"
        />
      )}
    </div>
  );
}
