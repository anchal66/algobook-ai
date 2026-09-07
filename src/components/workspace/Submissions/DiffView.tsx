"use client";
/** Monaco diff (Module 03 W-13): a past submission vs the current editor code. */
import { useEffect, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useTheme } from "next-themes";
import "@/lib/editor/monaco";
import { DARK_THEME, LIGHT_THEME, defineThemes } from "@/lib/editor/themes";
import { monacoFontFamily, useSettings } from "@/store/settings";
import type { Language } from "@/types";

const MONACO_LANG: Record<Language, string> = { java: "java", python: "python", cpp: "cpp", javascript: "javascript" };

export function DiffView({ original, modified, language }: { original: string; modified: string; language: Language }) {
  const editorSettings = useSettings((s) => s.editor);
  const { resolvedTheme } = useTheme();
  const dark = editorSettings.theme === "system" ? resolvedTheme !== "light" : editorSettings.theme === "dark";
  const ref = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);

  // Detach the models before the widget is torn down (otherwise Monaco logs
  // "TextModel got disposed before DiffEditorWidget model got reset").
  useEffect(() => () => {
    const ed = ref.current;
    if (!ed) return;
    const m = ed.getModel();
    try { ed.setModel(null); } catch { /* already disposed */ }
    m?.original.dispose();
    m?.modified.dispose();
    ref.current = null;
  }, []);

  return (
    <div className="h-full min-h-[240px] overflow-hidden rounded-[8px] border border-line/70">
      <DiffEditor
        height="100%"
        language={MONACO_LANG[language]}
        original={original}
        modified={modified}
        theme={dark ? DARK_THEME : LIGHT_THEME}
        beforeMount={(m) => defineThemes(m)}
        onMount={(ed) => { ref.current = ed; }}
        keepCurrentOriginalModel
        keepCurrentModifiedModel
        options={{
          readOnly: true, renderSideBySide: true, fontFamily: monacoFontFamily(editorSettings.font), fontSize: Math.max(11, editorSettings.fontSize - 1),
          minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, lineNumbersMinChars: 3, renderOverviewRuler: false,
        }}
      />
    </div>
  );
}
