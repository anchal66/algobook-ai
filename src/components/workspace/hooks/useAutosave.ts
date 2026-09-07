"use client";
/**
 * Autosave (Module 03 W-07): localStorage on every change, `PUT /api/drafts/:id` debounced 2 s.
 * Returns `onChange` for the editor. Status bar reads `saveStatus` from the store.
 */
import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { putDraft } from "@/lib/workspace/api";
import { writeLocalDraft } from "@/lib/workspace/drafts";
import { useWorkspace } from "@/store/workspace";
import type { Language } from "@/types";

const SERVER_DEBOUNCE_MS = 2000;

export function useAutosave(): { onChange: (code: string) => void; flush: () => Promise<void> } {
  const { user } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ problemId: string; language: Language; code: string } | null>(null);

  const send = useCallback(async () => {
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    const ws = useWorkspace.getState();
    ws.setSaveStatus("saving");
    try {
      await putDraft(p.problemId, p.language, p.code);
      // Only mark saved when nothing newer was typed meanwhile.
      if (!pending.current) useWorkspace.getState().setSaveStatus("saved");
    } catch {
      useWorkspace.getState().setSaveStatus("unsaved");
    }
  }, []);

  const onChange = useCallback((code: string) => {
    const ws = useWorkspace.getState();
    const problem = ws.problem;
    if (!problem) return;
    const language = ws.language;
    ws.setCode(language, code);
    if (user) writeLocalDraft(user.uid, problem.id, language, code);
    ws.setSaveStatus("unsaved");
    pending.current = { problemId: problem.id, language, code };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void send(); }, SERVER_DEBOUNCE_MS);
  }, [user, send]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    await send();
  }, [send]);

  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void send(); } }, [send]);
  useEffect(() => {
    const onHide = () => { if (pending.current) void flush(); };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  return { onChange, flush };
}
