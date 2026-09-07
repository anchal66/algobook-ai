"use client";
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

function Progress({ className, value = 0, indicatorClassName, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <ProgressPrimitive.Root data-slot="progress" className={cn("relative h-2 w-full overflow-hidden rounded-full bg-surface-3", className)} value={v} {...props}>
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full w-full flex-1 rounded-full bg-brand transition-transform duration-320 ease-out-quart", indicatorClassName)}
        style={{ transform: `translateX(-${100 - v}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
