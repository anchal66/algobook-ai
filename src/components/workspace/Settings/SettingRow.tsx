"use client";
/** Shared settings row: label + description on the left, control on the right. */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingRow({ label, description, children, className }: { label: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg-1">{label}</p>
        {description && <p className="text-xs text-fg-3">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex items-center rounded-[8px] bg-ws-chip p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={cn("h-7 rounded-[6px] px-3 text-xs font-medium transition-colors", value === o.value ? "bg-ws-panel text-fg-1 shadow-sm" : "text-fg-2 hover:text-fg-1")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
