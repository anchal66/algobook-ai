"use client";
/**
 * One workspace panel (Module 03 §1.2): an 8 px-radius card with a 36 px header, wrapped in a
 * react-resizable-panels <Panel> that can collapse to a 36 px strip or be rendered standalone
 * (maximized). Collapsed strips restore on click.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Panel, type PanelImperativeHandle, type PanelSize } from "react-resizable-panels";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelHeader, type PanelTab } from "@/components/workspace/Layout/PanelHeader";
import { registerPanel } from "@/components/workspace/Layout/layoutRegistry";
import { useWorkspace } from "@/store/workspace";
import { useSettings } from "@/store/settings";

export interface PanelSlot {
  id: string;
  tabs: PanelTab[];
  activeTab: string;
  onTabChange?: (id: string) => void;
  extra?: ReactNode;
  actions?: ReactNode;
  /** Label shown in the collapsed strip (defaults to the active tab label). */
  collapsedLabel?: string;
  defaultSize?: number;
  minSize?: string;
  children: ReactNode;
  bodyClassName?: string;
  /** Children stay mounted with `hidden` when the panel is collapsed (Monaco keeps its state). */
  keepMounted?: boolean;
}

export interface PanelCardProps extends PanelSlot {
  orientation: "horizontal" | "vertical";
  standalone?: boolean;
  /** Position of the panel inside its group, for the collapse chevron direction. */
  position?: "first" | "last";
}

const STRIP_PX = 36;

export function PanelCard(props: PanelCardProps) {
  const { id, orientation, standalone, position = "first", tabs, activeTab, onTabChange, extra, actions, children, bodyClassName, keepMounted, defaultSize, minSize = "120px" } = props;
  const maximized = useWorkspace((s) => s.maximized);
  const setUi = useWorkspace((s) => s.setUi);
  const setLayout = useSettings((s) => s.setLayout);
  const initiallyCollapsed = useSettings((s) => s.layout.collapsed[id] ?? false);
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const handleRef = useRef<PanelImperativeHandle | null>(null);
  const lastPersisted = useRef<boolean>(initiallyCollapsed);

  const panelRef = useCallback((h: PanelImperativeHandle | null) => {
    handleRef.current = h;
    registerPanel(id, h);
  }, [id]);

  useEffect(() => {
    if (initiallyCollapsed && handleRef.current && !handleRef.current.isCollapsed()) {
      try { handleRef.current.collapse(); } catch { /* not ready */ }
    }
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onResize = useCallback((size: PanelSize) => {
    const isCollapsed = size.inPixels > 0 && size.inPixels <= STRIP_PX + 8;
    setCollapsed(isCollapsed);
    if (lastPersisted.current !== isCollapsed) {
      lastPersisted.current = isCollapsed;
      setLayout({ collapsed: { ...useSettings.getState().layout.collapsed, [id]: isCollapsed } });
    }
  }, [id, setLayout]);

  const toggleMaximize = useCallback(() => setUi({ maximized: maximized === id ? null : id }), [maximized, id, setUi]);
  const persistCollapsed = useCallback((v: boolean) => {
    setCollapsed(v);
    if (lastPersisted.current !== v) {
      lastPersisted.current = v;
      setLayout({ collapsed: { ...useSettings.getState().layout.collapsed, [id]: v } });
    }
  }, [id, setLayout]);
  const collapse = useCallback(() => { handleRef.current?.collapse(); persistCollapsed(true); }, [persistCollapsed]);
  const expand = useCallback(() => { handleRef.current?.expand(); persistCollapsed(false); }, [persistCollapsed]);

  const collapseDirection = orientation === "horizontal" ? "left" : position === "first" ? "up" : "down";
  const activeLabel = props.collapsedLabel ?? tabs.find((t) => t.id === activeTab)?.label ?? id;
  const isMax = standalone || maximized === id;

  const card = (
    <div className={cn("flex h-full w-full flex-col overflow-hidden rounded-[8px] bg-ws-panel", collapsed && !standalone && "hidden")}>
      <PanelHeader
        tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} extra={extra} actions={actions}
        maximized={isMax} onMaximize={toggleMaximize} onCollapse={collapse} collapseDirection={collapseDirection}
      />
      <div className={cn("relative min-h-0 flex-1", bodyClassName)}>{children}</div>
    </div>
  );

  if (standalone) return card;

  const strip = orientation === "horizontal" ? (
    <button
      type="button"
      onClick={expand}
      aria-label={`Expand ${activeLabel}`}
      className="flex h-full w-full cursor-pointer flex-col items-center gap-2 rounded-[8px] bg-ws-panel py-2 text-fg-2 transition-colors hover:text-fg-1"
    >
      <ChevronRight className="size-4 shrink-0" />
      <span className="ws-vertical-text text-sm font-medium">{activeLabel}</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={expand}
      aria-label={`Expand ${activeLabel}`}
      className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-[8px] bg-ws-panel px-2 text-fg-2 transition-colors hover:text-fg-1"
    >
      <span className="flex size-4 items-center justify-center [&>svg]:size-4">{tabs.find((t) => t.id === activeTab)?.icon}</span>
      <span className="text-sm font-medium">{activeLabel}</span>
      <span className="ml-auto text-fg-3">{position === "first" ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}</span>
    </button>
  );

  return (
    <Panel
      id={id}
      panelRef={panelRef}
      collapsible
      collapsedSize={`${STRIP_PX}px`}
      minSize={minSize}
      defaultSize={defaultSize}
      onResize={onResize}
      className="min-h-0 min-w-0"
    >
      {collapsed && strip}
      {keepMounted || !collapsed ? card : null}
    </Panel>
  );
}
