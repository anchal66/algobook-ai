import { describe, expect, it } from "vitest";
import { SHORTCUTS, comboLabel, matchesCombo, shortcutById, type KeyCombo } from "@/lib/editor/shortcuts";

function ev(code: string, mods: Partial<Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "shiftKey">> = {}): KeyboardEvent {
  return { code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods } as KeyboardEvent;
}

describe("shortcut registry (Module 03 W-22)", () => {
  it("has unique ids and unique combos", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const combos = SHORTCUTS.map((s) => JSON.stringify({ ...s.combo }));
    expect(new Set(combos).size).toBe(combos.length);
  });

  it("matches ⌘' for run on mac and Ctrl+' elsewhere", () => {
    const run = shortcutById("run").combo;
    expect(matchesCombo(ev("Quote", { metaKey: true }), run, true)).toBe(true);
    expect(matchesCombo(ev("Quote", { ctrlKey: true }), run, true)).toBe(false);
    expect(matchesCombo(ev("Quote", { ctrlKey: true }), run, false)).toBe(true);
    expect(matchesCombo(ev("Quote"), run, true)).toBe(false);
  });

  it("rejects extra modifiers and different codes", () => {
    const submit = shortcutById("submit").combo;
    expect(matchesCombo(ev("Enter", { metaKey: true }), submit, true)).toBe(true);
    expect(matchesCombo(ev("Enter", { metaKey: true, shiftKey: true }), submit, true)).toBe(false);
    expect(matchesCombo(ev("KeyF", { altKey: true }), shortcutById("fullscreen").combo, true)).toBe(true);
    expect(matchesCombo(ev("KeyF", { altKey: true, shiftKey: true }), shortcutById("fullscreen").combo, true)).toBe(false);
    expect(matchesCombo(ev("KeyF", { altKey: true, shiftKey: true }), shortcutById("format").combo, true)).toBe(true);
  });

  it("renders platform-aware labels", () => {
    const combo: KeyCombo = { code: "Equal", alt: true };
    expect(comboLabel(combo, true)).toBe("⌥ +");
    expect(comboLabel(combo, false)).toBe("Alt + +");
    expect(comboLabel(shortcutById("run").combo, true)).toBe("⌘ '");
    expect(comboLabel(shortcutById("run").combo, false)).toBe("Ctrl + '");
    expect(comboLabel(shortcutById("format").combo, true)).toBe("⌥ ⇧ F");
  });
});
