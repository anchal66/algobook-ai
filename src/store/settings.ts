"use client";
/**
 * Workspace settings store (Module 03 W-02/W-21). Persists to localStorage immediately and to
 * `users.settings` via `PATCH /api/me/settings` (debounced 1.5 s). `hydrateFromServer` merges
 * the server copy on load so settings follow the user across devices.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorSettings, Language, UserSettings } from "@/types";
import type { ShortcutId } from "@/lib/editor/shortcuts";
import { patchSettings } from "@/lib/workspace/api";

export type ThemePref = "dark" | "light" | "system";
export type RunSubmitPlacement = "toolbar" | "editor";
export type TimerMode = "stopwatch" | "countdown";
export type KeyBinding = EditorSettings["keyBinding"];

export interface EditorPrefs {
  font: string;
  fontSize: number;
  ligatures: boolean;
  keyBinding: KeyBinding;
  tabSize: number;
  wordWrap: boolean;
  relativeLineNumbers: boolean;
  theme: ThemePref;
  language: Language;
  aiCompletion: boolean;
  minimap: boolean;
}

export interface LayoutPrefs {
  runSubmitPlacement: RunSubmitPlacement;
  realtimeResize: boolean;
  multiInstance: boolean;
  cloudLayout: boolean;
  /** Group id → panel id → percentage. */
  sizes: Record<string, Record<string, number>>;
  collapsed: Record<string, boolean>;
  tabs: Record<string, string>;
}

export interface TimerPrefs { visible: boolean; autoStart: boolean; mode: TimerMode; countdownMin: number }

export interface SettingsState {
  hydrated: boolean;
  editor: EditorPrefs;
  layout: LayoutPrefs;
  timer: TimerPrefs;
  /** Shortcut id → enabled. Missing = enabled. */
  shortcuts: Partial<Record<ShortcutId, boolean>>;
  setEditor: (patch: Partial<EditorPrefs>) => void;
  setLayout: (patch: Partial<LayoutPrefs>, opts?: { sync?: boolean }) => void;
  setTimer: (patch: Partial<TimerPrefs>) => void;
  setShortcut: (id: ShortcutId, enabled: boolean) => void;
  resetLayout: () => void;
  hydrateFromServer: (settings: UserSettings) => void;
}

export const DEFAULT_EDITOR: EditorPrefs = {
  font: "JetBrains Mono", fontSize: 14, ligatures: true, keyBinding: "standard", tabSize: 4, wordWrap: false,
  relativeLineNumbers: false, theme: "dark", language: "java", aiCompletion: false, minimap: false,
};
export const DEFAULT_LAYOUT: LayoutPrefs = {
  runSubmitPlacement: "toolbar", realtimeResize: true, multiInstance: false, cloudLayout: true,
  sizes: {}, collapsed: {}, tabs: {},
};
export const DEFAULT_TIMER: TimerPrefs = { visible: true, autoStart: false, mode: "stopwatch", countdownMin: 25 };

export const FONT_OPTIONS = ["Default", "JetBrains Mono", "Fira Code", "Source Code Pro"] as const;

function themeToServer(t: ThemePref): string {
  return t === "dark" ? "algobook-dark" : t === "light" ? "algobook-light" : "system";
}
function themeFromServer(s: string | undefined): ThemePref {
  if (s === "algobook-light") return "light";
  if (s === "system") return "system";
  return "dark";
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pending: Record<string, unknown> = {};
function queueSync(patch: Record<string, unknown>) {
  pending = { ...pending, ...patch };
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const body = pending; pending = {}; syncTimer = null;
    try { await patchSettings(body as never); } catch { /* signed out or offline: local copy still wins */ }
  }, 1500);
}

function serverEditor(e: EditorPrefs): Partial<EditorSettings> {
  const { minimap: _m, theme, ...rest } = e;
  return { ...rest, theme: themeToServer(theme) };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      editor: DEFAULT_EDITOR,
      layout: DEFAULT_LAYOUT,
      timer: DEFAULT_TIMER,
      shortcuts: {},
      setEditor: (patch) => {
        const editor = { ...get().editor, ...patch };
        set({ editor });
        queueSync({ editor: serverEditor(editor), layout: { ...get().layout, minimap: editor.minimap } });
      },
      setLayout: (patch, opts) => {
        const layout = { ...get().layout, ...patch };
        set({ layout });
        if (opts?.sync !== false) queueSync({ layout: { ...layout, minimap: get().editor.minimap, timerMode: get().timer.mode, countdownMin: get().timer.countdownMin } });
      },
      setTimer: (patch) => {
        const timer = { ...get().timer, ...patch };
        set({ timer });
        queueSync({ timer: { visible: timer.visible, autoStart: timer.autoStart }, layout: { ...get().layout, timerMode: timer.mode, countdownMin: timer.countdownMin } });
      },
      setShortcut: (id, enabled) => {
        const shortcuts = { ...get().shortcuts, [id]: enabled };
        set({ shortcuts });
        const wire: Record<string, string> = {};
        for (const [k, v] of Object.entries(shortcuts)) wire[k] = v ? "on" : "off";
        queueSync({ shortcuts: wire });
      },
      resetLayout: () => {
        const layout = { ...get().layout, sizes: {}, collapsed: {}, tabs: {} };
        set({ layout });
        queueSync({ layout });
      },
      hydrateFromServer: (s) => {
        const e = s.editor ?? ({} as Partial<EditorSettings>);
        const l = (s.layout ?? {}) as Partial<LayoutPrefs> & { minimap?: boolean; timerMode?: TimerMode; countdownMin?: number };
        const shortcuts: Partial<Record<ShortcutId, boolean>> = {};
        for (const [k, v] of Object.entries(s.shortcuts ?? {})) shortcuts[k as ShortcutId] = v !== "off";
        set({
          hydrated: true,
          editor: {
            ...get().editor,
            font: e.font ?? DEFAULT_EDITOR.font, fontSize: e.fontSize ?? DEFAULT_EDITOR.fontSize, ligatures: e.ligatures ?? DEFAULT_EDITOR.ligatures,
            keyBinding: e.keyBinding ?? DEFAULT_EDITOR.keyBinding, tabSize: e.tabSize ?? DEFAULT_EDITOR.tabSize, wordWrap: e.wordWrap ?? DEFAULT_EDITOR.wordWrap,
            relativeLineNumbers: e.relativeLineNumbers ?? DEFAULT_EDITOR.relativeLineNumbers, theme: themeFromServer(e.theme),
            language: e.language ?? DEFAULT_EDITOR.language, aiCompletion: e.aiCompletion ?? DEFAULT_EDITOR.aiCompletion,
            minimap: l.minimap ?? get().editor.minimap,
          },
          layout: {
            ...get().layout,
            runSubmitPlacement: l.runSubmitPlacement ?? get().layout.runSubmitPlacement,
            realtimeResize: l.realtimeResize ?? get().layout.realtimeResize,
            multiInstance: l.multiInstance ?? get().layout.multiInstance,
            cloudLayout: l.cloudLayout ?? get().layout.cloudLayout,
            sizes: l.sizes && Object.keys(l.sizes).length ? l.sizes : get().layout.sizes,
            collapsed: l.collapsed ?? get().layout.collapsed,
            tabs: l.tabs ?? get().layout.tabs,
          },
          timer: {
            visible: s.timer?.visible ?? get().timer.visible, autoStart: s.timer?.autoStart ?? get().timer.autoStart,
            mode: l.timerMode ?? get().timer.mode, countdownMin: l.countdownMin ?? get().timer.countdownMin,
          },
          shortcuts: Object.keys(shortcuts).length ? shortcuts : get().shortcuts,
        });
      },
    }),
    { name: "algobook:workspace-settings", version: 1, partialize: (s) => ({ editor: s.editor, layout: s.layout, timer: s.timer, shortcuts: s.shortcuts }) },
  ),
);

/** Resolves the editor font family for Monaco. */
export function monacoFontFamily(font: string): string {
  if (font === "Default") return "Menlo, Monaco, 'Courier New', monospace";
  return `'${font}', 'JetBrains Mono', Menlo, Monaco, monospace`;
}
