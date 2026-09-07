import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** EmptyState (Module 05 U-03): icon in a soft ring, title, description, optional action(s). */
export function EmptyState({ icon, title, description, action, className, compact }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14", className)}>
      {icon && (
        <div className="relative flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand [&_svg]:size-5">
          <span className="absolute inset-0 rounded-full border border-brand/30 animate-pulse-ring" aria-hidden />
          {icon}
        </div>
      )}
      <h3 className="text-md font-semibold text-text-1">{title}</h3>
      {description && <p className="max-w-sm text-sm text-text-2">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
