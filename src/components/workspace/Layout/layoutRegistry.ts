"use client";
/** Registry of mounted panel groups so Settings → Dynamic Layout → Reset and the lazy resize handle can act imperatively. */
import type { GroupImperativeHandle, PanelImperativeHandle } from "react-resizable-panels";

export const DEFAULT_LAYOUTS: Record<string, Record<string, number>> = {
  main: { left: 50, right: 50 },
  "main-side": { left: 40, right: 38, side: 22 },
  right: { code: 65, console: 35 },
};

const groups = new Map<string, GroupImperativeHandle>();
const groupEls = new Map<string, HTMLDivElement>();
const panels = new Map<string, PanelImperativeHandle>();

export function registerGroup(id: string, handle: GroupImperativeHandle | null): void {
  if (handle) groups.set(id, handle); else groups.delete(id);
}
export function registerGroupElement(id: string, el: HTMLDivElement | null): void {
  if (el) groupEls.set(id, el); else groupEls.delete(id);
}
export function registerPanel(id: string, handle: PanelImperativeHandle | null): void {
  if (handle) panels.set(id, handle); else panels.delete(id);
}
export function getGroup(id: string): GroupImperativeHandle | undefined { return groups.get(id); }
export function getGroupElement(id: string): HTMLDivElement | undefined { return groupEls.get(id); }
export function getPanel(id: string): PanelImperativeHandle | undefined { return panels.get(id); }

/** Expands every panel and restores the default percentages for every mounted group. */
export function resetPanelLayout(): void {
  for (const p of panels.values()) { try { if (p.isCollapsed()) p.expand(); } catch { /* unmounted */ } }
  for (const [id, g] of groups) {
    const def = DEFAULT_LAYOUTS[id];
    if (def) { try { g.setLayout(def); } catch { /* ignore */ } }
  }
}
