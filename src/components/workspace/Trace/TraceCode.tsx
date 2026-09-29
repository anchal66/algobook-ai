"use client";
/** Read-only code column of the visualizer (Module 07 V-09): current line, execution heat, breakpoints, click-to-jump. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import "@/lib/editor/monaco";
import { useTheme } from "next-themes";
import { DARK_THEME, LIGHT_THEME, defineThemes } from "@/lib/editor/themes";
import { monacoFontFamily, useSettings } from "@/store/settings";
import { useTrace } from "@/store/trace";
import { EditorSkeleton } from "@/components/workspace/Code/MonacoEditor";
import type { Trace } from "@/lib/trace/types";

const MONACO_LANG = { python: "python", javascript: "javascript" } as const;

export interface TraceCodeProps {
  trace: Trace;
  code: string;
  cursor: number;
  onJumpToLine: (line: number) => void;
}

export function TraceCode({ trace, code, cursor, onJumpToLine }: TraceCodeProps) {
  const editorSettings = useSettings((s) => s.editor);
  const breakpoints = useTrace((s) => s.breakpoints);
  const toggleBreakpoint = useTrace((s) => s.toggleBreakpoint);
  const { resolvedTheme } = useTheme();
  const [editor, setEditor] = useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<typeof Monaco | null>(null);
  const decorations = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const dark = editorSettings.theme === "system" ? resolvedTheme !== "light" : editorSettings.theme === "dark";

  const heat = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of trace.steps) if (s.ev === "line") counts.set(s.line, (counts.get(s.line) ?? 0) + 1);
    const max = Math.max(1, ...counts.values());
    return { counts, max };
  }, [trace]);

  const beforeMount: BeforeMount = useCallback((m) => { defineThemes(m); }, []);
  const onMount: OnMount = useCallback((ed, m) => {
    setEditor(ed); setMonaco(m);
    ed.onMouseDown((e) => {
      const line = e.target.position?.lineNumber;
      if (!line) return;
      const t = e.target.type;
      if (t === m.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || t === m.editor.MouseTargetType.GUTTER_LINE_NUMBERS) toggleBreakpoint(line);
      else onJumpToLine(line);
    });
  }, [onJumpToLine, toggleBreakpoint]);

  useEffect(() => {
    if (!editor || !monaco) return;
    const step = trace.steps[cursor];
    const line = step?.line ?? 1;
    const list: Monaco.editor.IModelDeltaDecoration[] = [];
    for (const [ln, n] of heat.counts) {
      const bucket = n / heat.max > 0.66 ? 3 : n / heat.max > 0.33 ? 2 : 1;
      list.push({ range: new monaco.Range(ln, 1, ln, 1), options: { isWholeLine: true, className: `trace-heat trace-heat-${bucket}` } });
    }
    for (const bp of breakpoints) list.push({ range: new monaco.Range(bp, 1, bp, 1), options: { glyphMarginClassName: "trace-glyph-breakpoint", glyphMarginHoverMessage: { value: "Breakpoint — playback pauses here" } } });
    if (step) {
      const cls = step.ev === "exception" ? "trace-line-exception" : step.ev === "return" ? "trace-line-return" : "trace-line-current";
      list.push({ range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className: cls, glyphMarginClassName: "trace-glyph-current", overviewRuler: { color: "#6366f1", position: monaco.editor.OverviewRulerLane.Full } } });
    }
    if (!decorations.current) decorations.current = editor.createDecorationsCollection(list);
    else decorations.current.set(list);
    editor.revealLineInCenterIfOutsideViewport(line);
  }, [editor, monaco, trace, cursor, heat, breakpoints]);

  useEffect(() => {
    editor?.updateOptions({ fontFamily: monacoFontFamily(editorSettings.font), fontSize: editorSettings.fontSize, fontLigatures: editorSettings.ligatures });
  }, [editor, editorSettings]);

  return (
    <Editor
      height="100%"
      language={MONACO_LANG[trace.lang]}
      value={code}
      theme={dark ? DARK_THEME : LIGHT_THEME}
      beforeMount={beforeMount}
      onMount={onMount}
      loading={<EditorSkeleton />}
      options={{
        readOnly: true, domReadOnly: true, fontFamily: monacoFontFamily(editorSettings.font), fontSize: editorSettings.fontSize, fontLigatures: editorSettings.ligatures,
        lineNumbers: "on", glyphMargin: true, folding: false, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false, renderLineHighlight: "none",
        lineNumbersMinChars: 3, padding: { top: 8, bottom: 8 }, wordWrap: "off", contextmenu: false, occurrencesHighlight: "off", selectionHighlight: false,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, useShadows: false }, overviewRulerBorder: false, hideCursorInOverviewRuler: true, cursorStyle: "line-thin", matchBrackets: "never",
      }}
    />
  );
}
