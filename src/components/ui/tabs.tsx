"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * Tabs (Module 05 U-03). `variant="underline"` is the LeetCode style (text tabs with a 2px active bar);
 * `variant="pill"` is the segmented control.
 */
type Variant = "underline" | "pill";
const VariantCtx = React.createContext<Variant>("underline");

function Tabs({ className, variant = "underline", ...props }: React.ComponentProps<typeof TabsPrimitive.Root> & { variant?: Variant }) {
  return (
    <VariantCtx.Provider value={variant}>
      <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />
    </VariantCtx.Provider>
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const v = React.useContext(VariantCtx);
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        v === "underline"
          ? "relative flex w-full items-end gap-1 overflow-x-auto no-scrollbar border-b border-line"
          : "inline-flex h-9 w-fit items-center rounded-[8px] bg-surface-2 p-[3px] text-text-2",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const v = React.useContext(VariantCtx);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium outline-none transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-brand/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        v === "underline"
          ? "-mb-px border-b-2 border-transparent px-3 py-2.5 text-text-2 hover:text-text-1 data-[state=active]:border-text-1 data-[state=active]:text-text-1"
          : "h-full flex-1 rounded-[6px] px-3 text-text-2 hover:text-text-1 data-[state=active]:bg-card data-[state=active]:text-text-1 data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
