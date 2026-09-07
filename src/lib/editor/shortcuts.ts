/**
 * Keyboard shortcut registry (Module 03 W-22). Single source of truth: the Settings →
 * Shortcuts page renders from it and `useShortcuts` binds from it.
 *
 * Matching uses `KeyboardEvent.code` (physical key) plus modifier flags. On macOS,
 * ⌥-combinations rewrite `event.key` (⌥F → "ƒ"), so a `code`-based matcher is the only
 * reliable way to bind ⌥F / ⌥+ / ⌥W the way LeetCode does.
 */

export type ShortcutId =
  | "run" | "submit" | "closeTab" | "maximizePanel" | "fullscreen"
  | "debugStart" | "debugStop" | "stepOver" | "stepInto" | "continue"
  | "format" | "nextProblem" | "prevProblem" | "toggleDescription" | "toggleConsole" | "focusEditor" | "commandPalette";

export type ShortcutGroup = "general" | "debug" | "algobook";

export interface KeyCombo {
  /** `KeyboardEvent.code`, e.g. "Quote", "Enter", "KeyW", "Equal", "F10". */
  code: string;
  /** "mod" = ⌘ on mac, Ctrl elsewhere. */
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
  ctrl?: boolean;
}

export interface Shortcut {
  id: ShortcutId;
  group: ShortcutGroup;
  label: string;
  combo: KeyCombo;
  /** LeetCode exposes on/off toggles for Run and Submit; we expose them for all. */
  toggleable: boolean;
  /** Works even while the Monaco editor has focus. */
  global: boolean;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "run", group: "general", label: "Run code", combo: { code: "Quote", mod: true }, toggleable: true, global: true },
  { id: "submit", group: "general", label: "Submit", combo: { code: "Enter", mod: true }, toggleable: true, global: true },
  { id: "closeTab", group: "general", label: "Close tab", combo: { code: "KeyW", alt: true }, toggleable: true, global: true },
  { id: "maximizePanel", group: "general", label: "Maximize / Exit Maximize Panel", combo: { code: "Equal", alt: true }, toggleable: true, global: true },
  { id: "fullscreen", group: "general", label: "Enter / Exit Full Screen", combo: { code: "KeyF", alt: true }, toggleable: true, global: true },
  { id: "debugStart", group: "debug", label: "Start Debugging", combo: { code: "Quote", mod: true, alt: true }, toggleable: false, global: true },
  { id: "debugStop", group: "debug", label: "Stop", combo: { code: "Escape" }, toggleable: false, global: false },
  { id: "stepOver", group: "debug", label: "Step over", combo: { code: "F10" }, toggleable: false, global: true },
  { id: "stepInto", group: "debug", label: "Step into", combo: { code: "F11" }, toggleable: false, global: true },
  { id: "continue", group: "debug", label: "Continue", combo: { code: "F8" }, toggleable: false, global: true },
  { id: "format", group: "algobook", label: "Format code", combo: { code: "KeyF", shift: true, alt: true }, toggleable: true, global: true },
  { id: "nextProblem", group: "algobook", label: "Next problem", combo: { code: "KeyN", alt: true }, toggleable: true, global: true },
  { id: "prevProblem", group: "algobook", label: "Previous problem", combo: { code: "KeyP", alt: true }, toggleable: true, global: true },
  { id: "toggleDescription", group: "algobook", label: "Toggle description", combo: { code: "Digit1", alt: true }, toggleable: true, global: true },
  { id: "toggleConsole", group: "algobook", label: "Toggle console", combo: { code: "Digit2", alt: true }, toggleable: true, global: true },
  { id: "focusEditor", group: "algobook", label: "Focus editor", combo: { code: "Digit3", alt: true }, toggleable: true, global: true },
  { id: "commandPalette", group: "algobook", label: "Command palette", combo: { code: "KeyK", mod: true }, toggleable: true, global: true },
];

export const SHORTCUT_GROUP_LABELS: Record<ShortcutGroup, string> = { general: "General", debug: "Debug", algobook: "AlgoBook" };

export function isMac(): boolean {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad/.test(navigator.platform) || /Mac OS/.test(navigator.userAgent);
}

const CODE_LABELS: Record<string, string> = {
  Quote: "'", Enter: "↵", Equal: "+", Escape: "Esc", Minus: "-", Backquote: "`", Space: "Space",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
};

function keyLabel(code: string): string {
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

/** Platform-aware label, e.g. "⌘ '" on mac, "Ctrl + '" on Windows/Linux. */
export function comboLabel(combo: KeyCombo, mac = isMac()): string {
  const parts: string[] = [];
  if (mac) {
    if (combo.ctrl) parts.push("⌃");
    if (combo.alt) parts.push("⌥");
    if (combo.shift) parts.push("⇧");
    if (combo.mod) parts.push("⌘");
    parts.push(keyLabel(combo.code));
    return parts.join(" ");
  }
  if (combo.mod) parts.push("Ctrl");
  if (combo.ctrl) parts.push("Ctrl");
  if (combo.alt) parts.push("Alt");
  if (combo.shift) parts.push("Shift");
  parts.push(keyLabel(combo.code));
  return parts.join(" + ");
}

/** True when `event` is exactly `combo` (all modifiers must match, extra modifiers reject). */
export function matchesCombo(event: KeyboardEvent, combo: KeyCombo, mac = isMac()): boolean {
  if (event.code !== combo.code) return false;
  const mod = mac ? event.metaKey : event.ctrlKey;
  const ctrlExtra = mac ? event.ctrlKey : false; // on non-mac, ctrl is "mod"
  if (mod !== !!combo.mod) return false;
  if (event.altKey !== !!combo.alt) return false;
  if (event.shiftKey !== !!combo.shift) return false;
  if (ctrlExtra !== !!combo.ctrl) return false;
  if (!mac && !!combo.ctrl && !event.ctrlKey) return false;
  return true;
}

export function shortcutById(id: ShortcutId): Shortcut {
  const s = SHORTCUTS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown shortcut ${id}`);
  return s;
}
