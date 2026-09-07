"use client";
/** < 1024 px layout (Module 03 W-26): segmented control Description | Code | Console (+ Notes/AI), fixed Run/Submit bar. */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";
import type { PanelSlot } from "@/components/workspace/Layout/PanelCard";
import { RunSubmitCluster } from "@/components/workspace/TopBar/RunSubmitCluster";

type Seg = "left" | "code" | "console" | "side";

export interface MobileLayoutProps { left: PanelSlot; code: PanelSlot; console: PanelSlot; side: PanelSlot | null; onRun: () => void; onSubmit: () => void }

export function MobileLayout({ left, code, console: consoleSlot, side, onRun, onSubmit }: MobileLayoutProps) {
  const [seg, setSeg] = useState<Seg>("left");
  const sidePanel = useWorkspace((s) => s.sidePanel);
  const runState = useWorkspace((s) => s.runState);
  const submitState = useWorkspace((s) => s.submitState);
  const active: Seg = seg === "side" && !side ? "left" : seg;
  // Jump to the console when a run/submit starts and stay there once the result lands.
  const busy = runState === "running" || submitState === "running";
  const prevBusy = useRef(false);
  useEffect(() => { if (busy && !prevBusy.current) setSeg("console"); prevBusy.current = busy; }, [busy]);
  const shown = busy && active !== "console" ? "console" : active;
  const slot = shown === "left" ? left : shown === "code" ? code : shown === "console" ? consoleSlot : side ?? left;
  const segments: { id: Seg; label: string }[] = [
    { id: "left", label: left.tabs.find((t) => t.id === left.activeTab)?.label ?? "Description" },
    { id: "code", label: "Code" },
    { id: "console", label: "Console" },
    ...(side ? [{ id: "side" as Seg, label: sidePanel === "notes" ? "Notes" : "AI" }] : []),
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      <div role="tablist" aria-label="Workspace sections" className="flex shrink-0 items-center rounded-[8px] bg-ws-panel p-0.5">
        {segments.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={shown === s.id} onClick={() => setSeg(s.id)} className={cn("h-8 flex-1 rounded-[6px] text-sm font-medium transition-colors", shown === s.id ? "bg-ws-chip text-fg-1" : "text-fg-2")}>{s.label}</button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] bg-ws-panel">
        <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto bg-ws-bar px-1 [scrollbar-width:none]">
          {slot.tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => slot.onTabChange?.(t.id)} className={cn("flex h-7 items-center gap-1 whitespace-nowrap rounded-[5px] px-2 text-sm font-medium", t.id === slot.activeTab ? "text-fg-1" : "text-fg-2")}>
              <span className={cn("flex size-4 items-center justify-center [&>svg]:size-4", t.iconClass)}>{t.icon}</span>{t.label}
            </button>
          ))}
          {slot.extra}
          <div className="ml-auto flex items-center">{slot.actions}</div>
        </div>
        <div className="relative min-h-0 flex-1">{slot.children}</div>
      </div>
      <div className="flex shrink-0 justify-center pb-[env(safe-area-inset-bottom)]">
        <RunSubmitCluster onRun={onRun} onSubmit={onSubmit} className="w-full justify-center" />
      </div>
    </div>
  );
}
