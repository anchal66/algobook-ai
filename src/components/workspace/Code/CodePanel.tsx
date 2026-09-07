"use client";
/**
 * Code panel pieces (Module 03 §1.7): header extras (language, autosave dot), header actions
 * (bookmark, format, reset, fullscreen, optional Run/Submit), and the body (Monaco + status bar).
 */
import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Bookmark, Braces, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCode } from "@/lib/editor/format";
import { comboLabel, shortcutById } from "@/lib/editor/shortcuts";
import { isBookmarked, toggleBookmark } from "@/lib/workspace/bookmarks";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/store/settings";
import { useWorkspace } from "@/store/workspace";
import { LanguageSelect } from "@/components/workspace/Code/LanguageSelect";
import { StatusBar } from "@/components/workspace/Code/StatusBar";
import { EditorSkeleton } from "@/components/workspace/Code/MonacoEditor";
import { getEditorInstance, replaceEditorValue, setEditorInstance } from "@/components/workspace/Code/editorRef";
import { RunSubmitCluster } from "@/components/workspace/TopBar/RunSubmitCluster";
import { ConfirmDialog, RESET_CODE_COPY } from "@/components/workspace/Overlays/ConfirmDialog";

const MonacoEditor = dynamic(() => import("@/components/workspace/Code/MonacoEditor").then((m) => m.MonacoEditor), { ssr: false, loading: () => <EditorSkeleton /> });

const actionBtn = "flex size-7 items-center justify-center rounded-[5px] text-fg-3 transition-colors hover:bg-ws-hover hover:text-fg-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60 disabled:opacity-40";

/** Runs the formatter on the current document (Monaco's own for JS, brace re-indent otherwise). */
export function formatCurrentCode(): void {
  const ws = useWorkspace.getState();
  const ed = getEditorInstance();
  if (!ed) return;
  if (ws.language === "javascript") {
    const action = ed.getAction("editor.action.formatDocument");
    if (action) { void action.run(); return; }
  }
  const model = ed.getModel();
  if (!model) return;
  const next = formatCode(ws.language, model.getValue(), useSettings.getState().editor.tabSize);
  if (next !== model.getValue()) replaceEditorValue(next);
  if (ws.language === "python") toast("Python keeps your indentation; trailing whitespace was trimmed.");
}

export function CodeHeaderExtra({ onBeforeSwitch }: { onBeforeSwitch?: () => Promise<void> }) {
  const saveStatus = useWorkspace((s) => s.saveStatus);
  return (
    <div className="ml-1 flex items-center gap-1">
      <span aria-hidden className="h-3.5 w-px bg-line/70" />
      <LanguageSelect onBeforeSwitch={onBeforeSwitch} />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex h-6 cursor-default items-center gap-1 rounded-[5px] px-1.5 text-sm text-fg-2">
            <span aria-hidden className={cn("size-1.5 rounded-full", saveStatus === "saved" ? "bg-fg-3" : saveStatus === "saving" ? "bg-medium" : "bg-medium/60")} />
            Auto
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">Autosave is on — drafts sync every 2 s</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function CodeHeaderActions({ onRun, onSubmit, onChange }: { onRun: () => void; onSubmit: () => void; onChange: (code: string) => void }) {
  const { user } = useAuth();
  const problem = useWorkspace((s) => s.problem);
  const language = useWorkspace((s) => s.language);
  const maximized = useWorkspace((s) => s.maximized);
  const setUi = useWorkspace((s) => s.setUi);
  const placement = useSettings((s) => s.layout.runSubmitPlacement);
  const [resetOpen, setResetOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(() => (user && problem ? isBookmarked(user.uid, problem.id) : false));

  const onBookmark = useCallback(() => {
    if (!user || !problem) return;
    const v = toggleBookmark(user.uid, problem.id);
    setBookmarked(v);
    toast(v ? "Bookmarked" : "Bookmark removed");
  }, [user, problem]);

  const doReset = useCallback(() => {
    const starter = problem?.starter[language] ?? "";
    if (!replaceEditorValue(starter)) onChange(starter);
    else onChange(starter);
  }, [problem, language, onChange]);

  return (
    <div className="flex items-center gap-0.5">
      {placement === "editor" && <RunSubmitCluster onRun={onRun} onSubmit={onSubmit} compact className="mr-1 bg-ws-bar" />}
      <Tooltip><TooltipTrigger asChild>
        <button type="button" onClick={onBookmark} aria-pressed={bookmarked} aria-label="Bookmark" className={cn(actionBtn, bookmarked && "text-medium")}><Bookmark className={cn("size-4", bookmarked && "fill-current")} /></button>
      </TooltipTrigger><TooltipContent side="bottom">{bookmarked ? "Remove bookmark" : "Bookmark"}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild>
        <button type="button" onClick={formatCurrentCode} aria-label="Format code" className={actionBtn}><Braces className="size-4" /></button>
      </TooltipTrigger><TooltipContent side="bottom">Format {comboLabel(shortcutById("format").combo)}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild>
        <button type="button" onClick={() => setResetOpen(true)} aria-label="Reset to default code" className={actionBtn}><RotateCcw className="size-4" /></button>
      </TooltipTrigger><TooltipContent side="bottom">Reset to default code</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild>
        <button type="button" onClick={() => setUi({ maximized: maximized === "code" ? null : "code" })} aria-label="Full screen editor" className={actionBtn}>
          {maximized === "code" ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </TooltipTrigger><TooltipContent side="bottom">{maximized === "code" ? "Exit full screen" : "Full screen"}</TooltipContent></Tooltip>
      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} description={RESET_CODE_COPY} onConfirm={doReset} />
    </div>
  );
}

export function CodeBody({ onChange }: { onChange: (code: string) => void }) {
  const language = useWorkspace((s) => s.language);
  const code = useWorkspace((s) => s.code[s.language]);
  const loading = useWorkspace((s) => s.loading);
  const [vimEl, setVimEl] = useState<HTMLDivElement | null>(null);

  if (loading || code === undefined) return <div className="flex h-full flex-col"><EditorSkeleton /></div>;
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <MonacoEditor value={code} language={language} onChange={onChange} onReady={(ed, m) => setEditorInstance(ed, m)} vimStatusEl={vimEl} />
      </div>
      <StatusBar vimStatusRef={setVimEl} />
    </div>
  );
}
