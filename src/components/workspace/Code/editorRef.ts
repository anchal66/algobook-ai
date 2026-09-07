"use client";
/** Module-level handle to the live Monaco editor so toolbar actions (format, focus, load code) can reach it. */
import type * as Monaco from "monaco-editor";

let current: Monaco.editor.IStandaloneCodeEditor | null = null;
let monacoApi: typeof Monaco | null = null;

export function setEditorInstance(editor: Monaco.editor.IStandaloneCodeEditor | null, monaco?: typeof Monaco): void {
  current = editor;
  if (monaco) monacoApi = monaco;
  // Development-only handle for browser QA scripts (never shipped in production bundles).
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as unknown as { __algobookEditor?: Monaco.editor.IStandaloneCodeEditor | null }).__algobookEditor = editor;
  }
}
export function getEditorInstance(): Monaco.editor.IStandaloneCodeEditor | null { return current; }
export function getMonaco(): typeof Monaco | null { return monacoApi; }

/** Replaces the whole document while keeping the undo stack. */
export function replaceEditorValue(text: string): boolean {
  const ed = current;
  const model = ed?.getModel();
  if (!ed || !model) return false;
  ed.pushUndoStop();
  ed.executeEdits("algobook", [{ range: model.getFullModelRange(), text, forceMoveMarkers: true }]);
  ed.pushUndoStop();
  return true;
}

export function focusEditor(): void { current?.focus(); }
