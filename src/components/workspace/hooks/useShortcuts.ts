"use client";
/** Binds the shortcut registry to window keydown (Module 03 W-22). Respects the per-shortcut toggles in settings. */
import { useEffect, useRef } from "react";
import { SHORTCUTS, matchesCombo, isMac, type ShortcutId } from "@/lib/editor/shortcuts";
import { useSettings } from "@/store/settings";

export type ShortcutHandlers = Partial<Record<ShortcutId, () => void>>;

export function useShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  const ref = useRef(handlers);
  useEffect(() => { ref.current = handlers; }, [handlers]);
  const toggles = useSettings((s) => s.shortcuts);

  useEffect(() => {
    if (!enabled) return;
    const mac = isMac();
    const onKey = (e: KeyboardEvent) => {
      // Ignore auto-repeat and IME composition.
      if (e.repeat || e.isComposing) return;
      for (const sc of SHORTCUTS) {
        if (!matchesCombo(e, sc.combo, mac)) continue;
        if (toggles[sc.id] === false) return;
        const target = e.target as HTMLElement | null;
        const inEditable = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
        // Non-global shortcuts (Esc) must not steal from inputs; global ones work everywhere except plain Escape in inputs.
        if (!sc.global && inEditable) return;
        const handler = ref.current[sc.id];
        if (!handler) return;
        e.preventDefault();
        e.stopPropagation();
        handler();
        return;
      }
    };
    // Capture phase so Monaco's own keybindings (e.g. ⌘Enter) do not swallow ours.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, toggles]);
}
