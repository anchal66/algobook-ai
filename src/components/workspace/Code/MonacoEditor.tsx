"use client";
/**
 * Monaco wrapper (Module 03 W-07/W-08/W-09): themes, options from settings, snippets, cursor
 * tracking, Vim/Emacs, AI inline completion. Loaded through next/dynamic in CodePanel.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import "@/lib/editor/monaco"; // bundled ESM Monaco + loader.config (no CDN)
import { useTheme } from "next-themes";
import { DARK_THEME, LIGHT_THEME, defineThemes } from "@/lib/editor/themes";
import { registerSnippetProviders } from "@/lib/editor/snippets";
import { monacoFontFamily, useSettings } from "@/store/settings";
import { useWorkspace } from "@/store/workspace";
import { useInlineCompletion } from "@/components/workspace/Code/useInlineCompletion";
import { useKeyBinding } from "@/components/workspace/Code/useKeyBinding";
import type { Language } from "@/types";

const MONACO_LANG: Record<Language, string> = { java: "java", python: "python", cpp: "cpp", javascript: "javascript" };
let snippetsRegistered = false;

export interface MonacoEditorProps {
  value: string;
  language: Language;
  onChange: (code: string) => void;
  onReady?: (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => void;
  vimStatusEl: HTMLElement | null;
  readOnly?: boolean;
  className?: string;
}

export function EditorSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-2 p-4" aria-busy="true" aria-label="Loading editor">
      {[70, 40, 55, 30, 60, 25].map((w, i) => <div key={i} className="ws-shimmer h-3.5 rounded" style={{ width: `${w}%` }} />)}
    </div>
  );
}

export function MonacoEditor({ value, language, onChange, onReady, vimStatusEl, readOnly, className }: MonacoEditorProps) {
  const editorSettings = useSettings((s) => s.editor);
  const { resolvedTheme } = useTheme();
  const setCursor = useWorkspace((s) => s.setCursor);
  const [editor, setEditor] = useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<typeof Monaco | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const dark = editorSettings.theme === "system" ? resolvedTheme !== "light" : editorSettings.theme === "dark";
  const theme = dark ? DARK_THEME : LIGHT_THEME;

  const beforeMount: BeforeMount = useCallback((m) => {
    defineThemes(m);
    if (!snippetsRegistered) { registerSnippetProviders(m); snippetsRegistered = true; }
  }, []);

  const onMount: OnMount = useCallback((ed, m) => {
    setEditor(ed);
    setMonaco(m);
    ed.onDidChangeCursorPosition((e) => setCursor({ line: e.position.lineNumber, col: e.position.column }));
    onReady?.(ed, m);
  }, [onReady, setCursor]);

  useInlineCompletion(monaco, editor);
  useKeyBinding(editor, editorSettings.keyBinding, vimStatusEl);

  useEffect(() => {
    if (!editor) return;
    editor.updateOptions({
      fontFamily: monacoFontFamily(editorSettings.font),
      fontSize: editorSettings.fontSize,
      fontLigatures: editorSettings.ligatures,
      tabSize: editorSettings.tabSize,
      wordWrap: editorSettings.wordWrap ? "on" : "off",
      lineNumbers: editorSettings.relativeLineNumbers ? "relative" : "on",
      minimap: { enabled: editorSettings.minimap },
      readOnly: !!readOnly,
    });
    editor.getModel()?.updateOptions({ tabSize: editorSettings.tabSize, insertSpaces: true });
  }, [editor, editorSettings, readOnly]);

  return (
    <div className={className ?? "h-full w-full"}>
      <Editor
        height="100%"
        language={MONACO_LANG[language]}
        value={value}
        theme={theme}
        beforeMount={beforeMount}
        onMount={onMount}
        onChange={(v) => onChangeRef.current(v ?? "")}
        loading={<EditorSkeleton />}
        options={{
          fontFamily: monacoFontFamily(editorSettings.font),
          fontSize: editorSettings.fontSize,
          fontLigatures: editorSettings.ligatures,
          tabSize: editorSettings.tabSize,
          insertSpaces: true,
          wordWrap: editorSettings.wordWrap ? "on" : "off",
          lineNumbers: editorSettings.relativeLineNumbers ? "relative" : "on",
          minimap: { enabled: editorSettings.minimap },
          readOnly: !!readOnly,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: "line",
          lineNumbersMinChars: 3,
          glyphMargin: false,
          folding: true,
          bracketPairColorization: { enabled: true },
          formatOnPaste: true,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          inlineSuggest: { enabled: true, showToolbar: "onHover" },
          suggest: { showSnippets: true, preview: true },
          quickSuggestions: { other: true, comments: false, strings: false },
          wordBasedSuggestions: "currentDocument",
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, useShadows: false },
          overviewRulerBorder: false,
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          fixedOverflowWidgets: true,
        }}
      />
    </div>
  );
}
