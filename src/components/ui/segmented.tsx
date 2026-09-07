"use client";
/** Segmented control (Module 05 U-03): a radiogroup for view switches that have no tab panels (leaderboard scope, list filters). */
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> { value: T; label: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }

export function Segmented<T extends string>({ value, onChange, options, label, className, size = "md" }: { value: T; onChange: (v: T) => void; options: SegmentedOption<T>[]; label: string; className?: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-[8px] bg-surface-2 p-[3px]", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const i = options.findIndex((x) => x.value === value);
              const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
              onChange(next.value);
              (e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined)?.focus();
            }}
            tabIndex={on ? 0 : -1}
            className={cn("flex items-center gap-1.5 rounded-[6px] font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-brand/40", size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm", on ? "bg-card text-text-1 shadow-sm" : "text-text-2 hover:text-text-1")}
          >
            {o.icon && <o.icon className="size-4" />}{o.label}
          </button>
        );
      })}
    </div>
  );
}
