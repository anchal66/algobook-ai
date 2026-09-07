"use client";
/** `Case 1` `Case 2` `+` chip row (Module 03 §1.8), with pass/fail dots in results and × on hover for custom cases. */
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Chip { id: string; label: string; status?: "pass" | "fail" | "none"; removable?: boolean }

export interface CaseChipsProps {
  chips: Chip[];
  active: number;
  onSelect: (i: number) => void;
  onRemove?: (i: number) => void;
  onAdd?: () => void;
  canAdd?: boolean;
}

export function CaseChips({ chips, active, onSelect, onRemove, onAdd, canAdd }: CaseChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Test cases">
      {chips.map((c, i) => (
        <div key={c.id} role="presentation" className="group/chip relative">
          <button
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => onSelect(i)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[6px] px-3 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60",
              i === active ? "bg-ws-chip text-fg-1" : "text-fg-2 hover:bg-ws-hover hover:text-fg-1",
            )}
          >
            {c.status && c.status !== "none" && <span aria-hidden className={cn("size-1.5 rounded-full", c.status === "pass" ? "bg-accepted" : "bg-wrong")} />}
            {c.label}
          </button>
          {c.removable && onRemove && (
            <button
              type="button"
              aria-label={`Remove ${c.label}`}
              onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-bg-3 text-fg-2 opacity-0 shadow transition-opacity group-hover/chip:opacity-100 hover:text-fg-1 focus-visible:opacity-100"
            >
              <X className="size-2.5" />
            </button>
          )}
        </div>
      ))}
      </div>
      {onAdd && (
        <button type="button" onClick={onAdd} disabled={!canAdd} aria-label="Add a custom test case" className="flex size-7 items-center justify-center rounded-[6px] text-fg-2 transition-colors hover:bg-ws-hover hover:text-fg-1 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60">
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}
