"use client";
/** Standard / Vim / Emacs key bindings for Monaco (Module 03 W-08). Libraries are loaded lazily. */
import { useEffect } from "react";
import type * as Monaco from "monaco-editor";
import type { KeyBinding } from "@/store/settings";

interface VimMode { dispose(): void }

export function useKeyBinding(editor: Monaco.editor.IStandaloneCodeEditor | null, keyBinding: KeyBinding, statusEl: HTMLElement | null): void {
  useEffect(() => {
    if (!editor || keyBinding === "standard") return;
    let disposed = false;
    let dispose: (() => void) | null = null;
    (async () => {
      try {
        if (keyBinding === "vim") {
          const mod = await import("monaco-vim");
          if (disposed) return;
          const vim: VimMode = mod.initVimMode(editor, statusEl ?? undefined);
          dispose = () => vim.dispose();
        } else {
          const mod = await import("monaco-emacs");
          if (disposed) return;
          const emacs = new mod.EmacsExtension(editor);
          emacs.start();
          dispose = () => emacs.dispose();
        }
      } catch (e) {
        console.error("Key binding failed to load", e);
      }
    })();
    return () => { disposed = true; dispose?.(); if (statusEl) statusEl.textContent = ""; };
  }, [editor, keyBinding, statusEl]);
}
