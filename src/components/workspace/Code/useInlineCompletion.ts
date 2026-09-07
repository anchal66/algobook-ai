"use client";
/**
 * AI inline completion provider (Module 03 W-09): ghost text after a 600 ms pause, cancelled on
 * keystroke, Tab accepts (Monaco default). Setting-gated; quota / plan errors disable it silently
 * for the session.
 */
import { useEffect, useRef } from "react";
import type * as Monaco from "monaco-editor";
import { ApiError, completeCode } from "@/lib/workspace/api";
import { track } from "@/lib/analytics";
import { useSettings } from "@/store/settings";
import { useWorkspace } from "@/store/workspace";
import { useMe } from "@/store/me";
import type { Language } from "@/types";

const DEBOUNCE_MS = 600;
const MONACO_LANG: Record<Language, string> = { java: "java", python: "python", cpp: "cpp", javascript: "javascript" };

let disabledForSession = false;

export function useInlineCompletion(monaco: typeof Monaco | null, editor: Monaco.editor.IStandaloneCodeEditor | null): void {
  const enabled = useSettings((s) => s.editor.aiCompletion);
  const language = useWorkspace((s) => s.language);
  const lastAccepted = useRef<string>("");

  useEffect(() => {
    if (!monaco || !editor || !enabled || disabledForSession) return;
    const provider: Monaco.languages.InlineCompletionsProvider = {
      async provideInlineCompletions(model, position, _context, token) {
        // Debounce: wait, bail if the user kept typing (Monaco cancels the token).
        await new Promise<void>((r) => setTimeout(r, DEBOUNCE_MS));
        if (token.isCancellationRequested) return { items: [] };
        const ws = useWorkspace.getState();
        if (ws.language !== language || !ws.problem) return { items: [] };
        const prefix = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
        const suffix = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: model.getLineCount(), endColumn: model.getLineMaxColumn(model.getLineCount()) });
        if (!prefix.trim()) return { items: [] };
        const ac = new AbortController();
        const sub = token.onCancellationRequested(() => ac.abort());
        try {
          const res = await completeCode({ language, prefix: prefix.slice(-40_000), suffix: suffix.slice(0, 10_000), problemId: ws.problem.id }, ac.signal);
          useMe.getState().bumpQuota("completion");
          const text = res.text ?? "";
          if (!text.trim() || token.isCancellationRequested) return { items: [] };
          lastAccepted.current = text;
          return { items: [{ insertText: text, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) }] };
        } catch (e) {
          if (e instanceof ApiError && (e.status === 402 || e.status === 429)) disabledForSession = true;
          return { items: [] };
        } finally {
          sub.dispose();
        }
      },
      disposeInlineCompletions() { /* nothing to free */ },
    };
    const d = monaco.languages.registerInlineCompletionsProvider(MONACO_LANG[language], provider);
    const acceptListener = editor.onDidChangeModelContent((e) => {
      const t = lastAccepted.current;
      if (t && e.changes.some((c) => c.text === t)) { track("completion_accept", { language, chars: t.length }); lastAccepted.current = ""; }
    });
    return () => { d.dispose(); acceptListener.dispose(); };
  }, [monaco, editor, enabled, language]);
}
