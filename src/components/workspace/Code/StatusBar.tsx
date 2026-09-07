"use client";
/** `Saved` / `Saving…` / `Unsaved` on the left, `Ln 1, Col 1` on the right (Module 03 §1.7). */
import { useWorkspace } from "@/store/workspace";
import { cn } from "@/lib/utils";

export function StatusBar({ vimStatusRef }: { vimStatusRef?: React.Ref<HTMLDivElement> }) {
  const saveStatus = useWorkspace((s) => s.saveStatus);
  const cursor = useWorkspace((s) => s.cursor);
  const label = saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving…" : "Unsaved";
  return (
    <div className="flex h-6 shrink-0 items-center justify-between px-3 text-xs text-fg-3">
      <div className="flex items-center gap-3">
        <span className={cn(saveStatus === "unsaved" && "text-medium")} aria-live="polite">{label}</span>
        <div ref={vimStatusRef} className="ws-vim-status text-fg-2" />
      </div>
      <span className="tabular-nums">Ln {cursor.line}, Col {cursor.col}</span>
    </div>
  );
}
