/**
 * Monaco themes (Module 03 W-01). `algobook-dark` is the v1 palette ported onto LeetCode's
 * editor surface (#262626 measured on leetcode.com, 2026-09-08); `algobook-light` mirrors it.
 */
import type * as Monaco from "monaco-editor";

export const DARK_THEME = "algobook-dark";
export const LIGHT_THEME = "algobook-light";

const darkRules: Monaco.editor.ITokenThemeRule[] = [
  { token: "keyword", foreground: "cba6f7", fontStyle: "bold" },
  { token: "keyword.control", foreground: "cba6f7", fontStyle: "bold" },
  { token: "string", foreground: "a6e3a1" },
  { token: "string.escape", foreground: "94e2d5" },
  { token: "number", foreground: "fab387" },
  { token: "number.float", foreground: "fab387" },
  { token: "comment", foreground: "7f849c", fontStyle: "italic" },
  { token: "comment.doc", foreground: "7f849c", fontStyle: "italic" },
  { token: "type", foreground: "f9e2af" },
  { token: "type.identifier", foreground: "f9e2af" },
  { token: "delimiter", foreground: "9399b2" },
  { token: "delimiter.bracket", foreground: "9399b2" },
  { token: "annotation", foreground: "f9e2af" },
  { token: "variable", foreground: "cdd6f4" },
  { token: "variable.predefined", foreground: "f38ba8" },
  { token: "constant", foreground: "fab387" },
  { token: "operator", foreground: "89dceb" },
  { token: "tag", foreground: "89b4fa" },
  { token: "attribute.name", foreground: "f9e2af" },
  { token: "attribute.value", foreground: "a6e3a1" },
];

const lightRules: Monaco.editor.ITokenThemeRule[] = [
  { token: "keyword", foreground: "8839ef", fontStyle: "bold" },
  { token: "keyword.control", foreground: "8839ef", fontStyle: "bold" },
  { token: "string", foreground: "40a02b" },
  { token: "string.escape", foreground: "179299" },
  { token: "number", foreground: "fe640b" },
  { token: "number.float", foreground: "fe640b" },
  { token: "comment", foreground: "8c8fa1", fontStyle: "italic" },
  { token: "comment.doc", foreground: "8c8fa1", fontStyle: "italic" },
  { token: "type", foreground: "df8e1d" },
  { token: "type.identifier", foreground: "df8e1d" },
  { token: "delimiter", foreground: "6c6f85" },
  { token: "delimiter.bracket", foreground: "6c6f85" },
  { token: "annotation", foreground: "df8e1d" },
  { token: "variable", foreground: "4c4f69" },
  { token: "variable.predefined", foreground: "d20f39" },
  { token: "constant", foreground: "fe640b" },
  { token: "operator", foreground: "04a5e5" },
  { token: "tag", foreground: "1e66f5" },
  { token: "attribute.name", foreground: "df8e1d" },
  { token: "attribute.value", foreground: "40a02b" },
];

export const darkTheme: Monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: darkRules,
  colors: {
    "editor.background": "#262626",
    "editor.foreground": "#d4d4d4",
    "editor.lineHighlightBackground": "#2d2d2d",
    "editor.lineHighlightBorder": "#00000000",
    "editor.selectionBackground": "#45475a80",
    "editor.selectionHighlightBackground": "#45475a40",
    "editor.inactiveSelectionBackground": "#31324460",
    "editorCursor.foreground": "#f5e0dc",
    "editorLineNumber.foreground": "#6b6b6b",
    "editorLineNumber.activeForeground": "#c6c6c6",
    "editorIndentGuide.background1": "#3a3a3a",
    "editorIndentGuide.activeBackground1": "#4f4f4f",
    "editorBracketMatch.background": "#89b4fa15",
    "editorBracketMatch.border": "#89b4fa40",
    "editorBracketHighlight.foreground1": "#f38ba8",
    "editorBracketHighlight.foreground2": "#fab387",
    "editorBracketHighlight.foreground3": "#89b4fa",
    "editorBracketHighlight.foreground4": "#a6e3a1",
    "editorBracketHighlight.foreground5": "#f9e2af",
    "editorBracketHighlight.foreground6": "#cba6f7",
    "editorSuggestWidget.background": "#262626",
    "editorSuggestWidget.border": "#3e3e3e",
    "editorSuggestWidget.foreground": "#d4d4d4",
    "editorSuggestWidget.highlightForeground": "#89b4fa",
    "editorSuggestWidget.selectedBackground": "#3a3a3a",
    "editorSuggestWidget.selectedForeground": "#f5f5f5",
    "editorWidget.background": "#262626",
    "editorWidget.border": "#3e3e3e",
    "editorHoverWidget.background": "#262626",
    "editorHoverWidget.border": "#3e3e3e",
    "editorGhostText.foreground": "#8a8a8a",
    "scrollbarSlider.background": "#ffffff1a",
    "scrollbarSlider.hoverBackground": "#ffffff2e",
    "scrollbarSlider.activeBackground": "#ffffff40",
    "editorGutter.background": "#262626",
    "editorOverviewRuler.border": "#00000000",
    "minimap.background": "#262626",
    focusBorder: "#89b4fa40",
    "list.hoverBackground": "#333333",
    "list.activeSelectionBackground": "#3e3e3e",
    "input.background": "#333333",
    "input.border": "#3e3e3e",
    "input.foreground": "#d4d4d4",
  },
};

export const lightTheme: Monaco.editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: lightRules,
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#1f2328",
    "editor.lineHighlightBackground": "#f6f8fa",
    "editor.lineHighlightBorder": "#00000000",
    "editor.selectionBackground": "#b4d7ff80",
    "editor.selectionHighlightBackground": "#b4d7ff40",
    "editor.inactiveSelectionBackground": "#e5e7eb",
    "editorCursor.foreground": "#1f2328",
    "editorLineNumber.foreground": "#9ca3af",
    "editorLineNumber.activeForeground": "#4b5563",
    "editorIndentGuide.background1": "#e5e7eb",
    "editorIndentGuide.activeBackground1": "#d0d4da",
    "editorBracketMatch.background": "#1e66f515",
    "editorBracketMatch.border": "#1e66f540",
    "editorSuggestWidget.background": "#ffffff",
    "editorSuggestWidget.border": "#d0d4da",
    "editorSuggestWidget.foreground": "#1f2328",
    "editorSuggestWidget.highlightForeground": "#1e66f5",
    "editorSuggestWidget.selectedBackground": "#eff1f4",
    "editorSuggestWidget.selectedForeground": "#111827",
    "editorWidget.background": "#ffffff",
    "editorWidget.border": "#d0d4da",
    "editorHoverWidget.background": "#ffffff",
    "editorHoverWidget.border": "#d0d4da",
    "editorGhostText.foreground": "#9ca3af",
    "scrollbarSlider.background": "#0000001a",
    "scrollbarSlider.hoverBackground": "#0000002e",
    "scrollbarSlider.activeBackground": "#00000040",
    "editorGutter.background": "#ffffff",
    "editorOverviewRuler.border": "#00000000",
    "minimap.background": "#ffffff",
    focusBorder: "#1e66f540",
    "list.hoverBackground": "#eff1f4",
    "list.activeSelectionBackground": "#e5e7eb",
    "input.background": "#f7f8fa",
    "input.border": "#d0d4da",
    "input.foreground": "#111827",
  },
};

let defined = false;
/** Registers both themes once per Monaco instance. Safe to call repeatedly. */
export function defineThemes(monaco: typeof Monaco): void {
  if (defined) return;
  monaco.editor.defineTheme(DARK_THEME, darkTheme);
  monaco.editor.defineTheme(LIGHT_THEME, lightTheme);
  defined = true;
}
