"use client";
/**
 * Root panel arrangement (Module 03 W-03): left group | right column (code / console) [| side].
 * Sizes persist per group in settings (`layout.sizes`) and are read before the first paint.
 */
import { useCallback, useMemo } from "react";
import { Group, type GroupImperativeHandle, type Layout, type LayoutChangedMeta } from "react-resizable-panels";
import { PanelCard, type PanelSlot } from "@/components/workspace/Layout/PanelCard";
import { ResizeHandle } from "@/components/workspace/Layout/ResizeHandle";
import { DEFAULT_LAYOUTS, registerGroup, registerGroupElement } from "@/components/workspace/Layout/layoutRegistry";
import { useSettings } from "@/store/settings";
import { useWorkspace } from "@/store/workspace";

export interface WorkspaceLayoutProps {
  left: PanelSlot;
  code: PanelSlot;
  console: PanelSlot;
  side?: PanelSlot | null;
}

function sameLayout(a: Layout | undefined, b: Layout): boolean {
  if (!a) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return kb.every((k) => Math.abs((a[k] ?? -1) - b[k]) < 0.01);
}

export function WorkspaceLayout({ left, code, console: consoleSlot, side }: WorkspaceLayoutProps) {
  const maximized = useWorkspace((s) => s.maximized);
  const sizes = useSettings((s) => s.layout.sizes);
  const realtime = useSettings((s) => s.layout.realtimeResize);
  const setLayout = useSettings((s) => s.setLayout);

  const mainId = side ? "main-side" : "main";
  const persist = useCallback((groupId: string) => (layout: Layout, _meta: LayoutChangedMeta) => {
    // A collapsed panel shows up as a ~2 % slot; persisting that would re-collapse it on reload.
    // Collapsed state is stored separately (layout.collapsed), so only expanded layouts are saved.
    if (Object.values(layout).some((v) => v < 6)) return;
    const cur = useSettings.getState().layout.sizes;
    if (sameLayout(cur[groupId], layout)) return;
    setLayout({ sizes: { ...cur, [groupId]: layout } });
  }, [setLayout]);

  const mainDefault = useMemo(() => {
    const saved = sizes[mainId];
    const def = DEFAULT_LAYOUTS[mainId];
    return saved && Object.keys(def).every((k) => k in saved) ? saved : def;
  }, [sizes, mainId]);
  const rightDefault = useMemo(() => {
    const saved = sizes.right;
    return saved && "code" in saved && "console" in saved ? saved : DEFAULT_LAYOUTS.right;
  }, [sizes]);

  const groupRef = useCallback((id: string) => (h: GroupImperativeHandle | null) => registerGroup(id, h), []);
  const elRef = useCallback((id: string) => (el: HTMLDivElement | null) => registerGroupElement(id, el), []);

  if (maximized) {
    const slot = maximized === left.id ? left : maximized === code.id ? code : maximized === consoleSlot.id ? consoleSlot : side && maximized === side.id ? side : null;
    if (slot) {
      return (
        <div className="h-full w-full">
          <PanelCard {...slot} orientation="horizontal" standalone />
        </div>
      );
    }
  }

  return (
    <Group id={mainId} key={mainId} orientation="horizontal" defaultLayout={mainDefault} onLayoutChanged={persist(mainId)} groupRef={groupRef(mainId)} elementRef={elRef(mainId)} className="h-full w-full">
      <PanelCard {...left} orientation="horizontal" minSize={left.minSize ?? "240px"} />
      <ResizeHandle groupId={mainId} before={left.id} after="right" orientation="horizontal" lazy={!realtime} />
      <PanelCardlessColumn>
        <Group id="right" orientation="vertical" defaultLayout={rightDefault} onLayoutChanged={persist("right")} groupRef={groupRef("right")} elementRef={elRef("right")} className="h-full w-full">
          <PanelCard {...code} orientation="vertical" position="first" minSize={code.minSize ?? "120px"} keepMounted />
          <ResizeHandle groupId="right" before={code.id} after={consoleSlot.id} orientation="vertical" lazy={!realtime} />
          <PanelCard {...consoleSlot} orientation="vertical" position="last" minSize={consoleSlot.minSize ?? "100px"} />
        </Group>
      </PanelCardlessColumn>
      {side && (
        <>
          <ResizeHandle groupId={mainId} before="right" after={side.id} orientation="horizontal" lazy={!realtime} />
          <PanelCard {...side} orientation="horizontal" minSize={side.minSize ?? "260px"} />
        </>
      )}
    </Group>
  );
}

import { Panel } from "react-resizable-panels";
/** The right column is a plain Panel hosting the vertical group (not a card). */
function PanelCardlessColumn({ children }: { children: React.ReactNode }) {
  return (
    <Panel id="right" minSize="280px" className="min-h-0 min-w-0">
      {children}
    </Panel>
  );
}
