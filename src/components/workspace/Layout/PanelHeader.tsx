"use client";
/**
 * 36 px panel header (Module 03 §1.2): tab strip on the left, maximize / collapse icons on hover.
 * Matches LeetCode: bar background rgba(255,255,255,.06), tab buttons 28 px, 4×8 padding, 5 px radius.
 */
import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PanelTab { id: string; label: string; icon: ReactNode; iconClass?: string }

export interface PanelHeaderProps {
  tabs: PanelTab[];
  activeTab: string;
  onTabChange?: (id: string) => void;
  /** Extra controls rendered after the tabs (language select, autosave dot…). */
  extra?: ReactNode;
  /** Right-side controls that are always visible (before the hover icons). */
  actions?: ReactNode;
  maximized: boolean;
  onMaximize: () => void;
  onCollapse: () => void;
  collapseDirection: "left" | "down" | "up";
  className?: string;
}

export function PanelHeader({ tabs, activeTab, onTabChange, extra, actions, maximized, onMaximize, onCollapse, collapseDirection, className }: PanelHeaderProps) {
  const CollapseIcon = collapseDirection === "left" ? ChevronLeft : collapseDirection === "up" ? ChevronUp : ChevronDown;
  return (
    <div className={cn("group/header flex h-9 shrink-0 items-center rounded-t-[8px] bg-ws-bar px-1", className)}>
      <div role="tablist" aria-orientation="horizontal" className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none]">
        {tabs.map((t, i) => {
          const active = t.id === activeTab;
          return (
            <div key={t.id} role="presentation" className="flex items-center">
              {i > 0 && <span aria-hidden className="mx-0.5 h-3.5 w-px bg-line/70" />}
              <button
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onTabChange?.(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
                    onTabChange?.(next.id);
                    (e.currentTarget.parentElement?.parentElement?.querySelector(`[data-tab="${next.id}"]`) as HTMLButtonElement | null)?.focus();
                  }
                }}
                data-tab={t.id}
                className={cn(
                  "flex h-7 items-center gap-1 whitespace-nowrap rounded-[5px] px-2 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60",
                  active ? "text-fg-1" : "text-fg-2 hover:bg-ws-hover hover:text-fg-1",
                )}
              >
                <span className={cn("flex size-4 items-center justify-center [&>svg]:size-4", t.iconClass)}>{t.icon}</span>
                {t.label}
              </button>
            </div>
          );
        })}
        {extra}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 pl-1">
        {actions}
        <button
          type="button"
          aria-label={maximized ? "Exit maximize" : "Maximize"}
          title={maximized ? "Exit maximize (⌥+)" : "Maximize (⌥+)"}
          onClick={onMaximize}
          className={cn("flex size-7 items-center justify-center rounded-[5px] text-fg-3 transition-opacity duration-150 hover:bg-ws-hover hover:text-fg-1 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-from/60 focus:outline-none", maximized ? "opacity-100" : "opacity-0 group-hover/header:opacity-100")}
        >
          {maximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
        {!maximized && (
          <button
            type="button"
            aria-label="Collapse"
            title="Collapse"
            onClick={onCollapse}
            className="flex size-7 items-center justify-center rounded-[5px] text-fg-3 opacity-0 transition-opacity duration-150 group-hover/header:opacity-100 hover:bg-ws-hover hover:text-fg-1 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-from/60 focus:outline-none"
          >
            <CollapseIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
