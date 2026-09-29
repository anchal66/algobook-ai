"use client";
/**
 * Arena integrity monitor (Module 06 §3.9 / V-18): paste-from-outside (reverted), copy blocking, tab/window
 * absence, full-screen exit, typing bursts, heartbeat. Events are batched every 2 s and flushed with
 * `sendBeacon` on page hide. Everything it records is shown to the participant in the Integrity panel.
 */
import { useEffect, useRef } from "react";
import { rooms } from "@/lib/app/api";
import { getEditorInstance } from "@/components/workspace/Code/editorRef";
import { useRoom } from "@/store/room";
import { useWorkspace } from "@/store/workspace";
import { auth } from "@/lib/firebase";

interface PendingEvent { type: string; at: number; meta?: Record<string, unknown>; clientSeq: number; sessionId?: string }

const HEARTBEAT_MS = 20_000;
const FLUSH_MS = 2000;
const ABSENCE_MIN_MS = 5000;
const BURST_CHARS = 120;

export interface IntegrityOptions { roomId: string; enabled: boolean; blockPaste: boolean; blockCopy: boolean; requireFullscreen: boolean }

export function useIntegrityMonitor(o: IntegrityOptions): void {
  const seq = useRef(0);
  const queue = useRef<PendingEvent[]>([]);
  const sessionId = useRef<string>("");
  const lastInternalCopy = useRef<string>("");
  const optsRef = useRef(o);
  useEffect(() => { optsRef.current = o; }, [o]);

  useEffect(() => {
    if (!o.enabled) return;
    // One id per browser tab that survives reloads (sessionStorage is per tab): a refresh is not a second session, another tab is.
    if (!sessionId.current) {
      let id: string | null = null;
      try { id = sessionStorage.getItem("algobook:roomSession"); } catch { /* unavailable */ }
      if (!id) { id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()); try { sessionStorage.setItem("algobook:roomSession", id); } catch { /* ignore */ } }
      sessionId.current = id;
    }
    const push = (type: string, meta?: Record<string, unknown>) => {
      queue.current.push({ type, at: Date.now(), meta, clientSeq: ++seq.current, sessionId: sessionId.current });
    };
    const flush = async (beacon = false) => {
      if (!queue.current.length) return;
      const batch = queue.current.splice(0, 20);
      if (beacon) {
        // best effort on page hide: the beacon cannot carry the auth header, so keep the batch for the next mount
        queue.current.unshift(...batch);
        return;
      }
      try {
        const res = await rooms.postEvents(o.roomId, batch);
        useRoom.getState().patchMe({ violations: res.violations, score: res.score });
      } catch {
        queue.current.unshift(...batch);
      }
    };

    // heartbeat
    push("heartbeat", { tab: document.visibilityState });
    const hb = setInterval(() => push("heartbeat", { tab: document.visibilityState }), HEARTBEAT_MS);
    const fl = setInterval(() => void flush(), FLUSH_MS);

    // absence: visibility + blur
    let hiddenAt: number | null = null, blurAt: number | null = null;
    const onVis = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); push("heartbeat", { tab: "hidden" }); }
      else if (hiddenAt !== null) { const d = Date.now() - hiddenAt; hiddenAt = null; push("heartbeat", { tab: "visible" }); if (d >= ABSENCE_MIN_MS) push("tab_hidden", { durationMs: d }); }
    };
    const onBlur = () => { if (document.visibilityState === "visible") blurAt = Date.now(); };
    const onFocus = () => { if (blurAt !== null) { const d = Date.now() - blurAt; blurAt = null; if (d >= ABSENCE_MIN_MS && document.visibilityState === "visible") push("window_blur", { durationMs: d }); } };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    // full screen
    const onFs = () => { if (optsRef.current.requireFullscreen && !document.fullscreenElement) push("fullscreen_exit"); };
    document.addEventListener("fullscreenchange", onFs);

    // copy / cut: remember what was copied from the editor; block copies of the statement
    const onCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditor = !!target?.closest?.(".monaco-editor");
      if (inEditor) {
        const ed = getEditorInstance();
        const sel = ed?.getModel()?.getValueInRange(ed.getSelection()!) ?? window.getSelection()?.toString() ?? "";
        lastInternalCopy.current = sel;
        if (optsRef.current.blockCopy) { e.preventDefault(); push("copy_blocked", { source: "editor", chars: sel.length }); }
        return;
      }
      if (optsRef.current.blockCopy && target?.closest?.(".ws-root")) { e.preventDefault(); push("copy_blocked", { source: "statement" }); }
    };
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCopy, true);

    // paste + typing bursts inside Monaco
    let disposePaste: { dispose(): void } | null = null, disposeChange: { dispose(): void } | null = null;
    let pasteWindow: number | null = null;
    const attach = () => {
      const ed = getEditorInstance();
      if (!ed) return false;
      disposePaste = ed.onDidPaste((e) => {
        const model = ed.getModel();
        if (!model) return;
        const text = model.getValueInRange(e.range);
        pasteWindow = Date.now();
        const internal = lastInternalCopy.current && text.trim() === lastInternalCopy.current.trim();
        if (internal) return;
        push("paste_external", { chars: text.length });
        if (optsRef.current.blockPaste) {
          ed.executeEdits("integrity", [{ range: e.range, text: "" }]);
          const ws = useWorkspace.getState();
          ws.setCode(ws.language, model.getValue());
        }
      });
      disposeChange = ed.onDidChangeModelContent((e) => {
        if (e.isFlush || e.isUndoing || e.isRedoing) return;
        const inserted = e.changes.reduce((n, c) => n + c.text.length, 0);
        if (inserted < BURST_CHARS) return;
        // a paste fires onDidPaste right after; give it a tick before deciding it was an injection
        setTimeout(() => { if (pasteWindow === null || Date.now() - pasteWindow > 300) push("typing_burst", { chars: inserted }); }, 150);
      });
      return true;
    };
    let tries = 0;
    const retry = setInterval(() => { if (attach() || ++tries > 40) clearInterval(retry); }, 500);

    const onHide = () => { void flush(true); };
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(hb); clearInterval(fl); clearInterval(retry);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCopy, true);
      window.removeEventListener("pagehide", onHide);
      disposePaste?.dispose(); disposeChange?.dispose();
      void flush();
    };
  }, [o.enabled, o.roomId]);

  // keep the session's uid handy for debugging (no-op)
  void auth;
}
