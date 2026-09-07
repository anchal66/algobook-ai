import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Difficulty, ItemStatus } from "@/types";

/** Badge / Chip (Module 05 U-03): difficulty, topic, status and brand chips. */
const badgeVariants = cva("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-chip border font-medium tabular [&_svg]:size-3", {
  variants: {
    variant: {
      neutral: "border-transparent bg-surface-2 text-text-2",
      outline: "border-line bg-transparent text-text-2",
      brand: "border-transparent bg-brand-soft text-brand",
      easy: "border-transparent bg-easy/12 text-easy",
      medium: "border-transparent bg-medium/14 text-[#b58500] dark:text-medium",
      hard: "border-transparent bg-hard/12 text-hard",
      ok: "border-transparent bg-ok/12 text-ok",
      err: "border-transparent bg-err/12 text-err",
      warn: "border-transparent bg-warn/14 text-[#b58500] dark:text-warn",
      info: "border-transparent bg-info/12 text-info",
      solid: "border-transparent bg-text-1 text-surface-0",
      gradient: "border-transparent bg-brand text-white",
    },
    size: { sm: "h-5 px-1.5 text-2xs", md: "h-6 px-2 text-xs", lg: "h-7 px-2.5 text-sm" },
  },
  defaultVariants: { variant: "neutral", size: "md" },
});

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

const DIFF_VARIANT: Record<Difficulty, BadgeProps["variant"]> = { Easy: "easy", Medium: "medium", Hard: "hard" };
function DifficultyBadge({ difficulty, size, className, plain }: { difficulty: Difficulty; size?: BadgeProps["size"]; className?: string; plain?: boolean }) {
  if (plain) {
    return <span className={cn("text-sm font-medium", difficulty === "Easy" ? "text-easy" : difficulty === "Medium" ? "text-[#b58500] dark:text-medium" : "text-hard", className)}>{difficulty}</span>;
  }
  return <Badge variant={DIFF_VARIANT[difficulty]} size={size} className={className}>{difficulty}</Badge>;
}

const STATUS_LABEL: Record<ItemStatus, string> = { todo: "Todo", attempting: "Attempting", solved: "Solved" };
const STATUS_VARIANT: Record<ItemStatus, BadgeProps["variant"]> = { todo: "outline", attempting: "warn", solved: "ok" };
function StatusBadge({ status, size, className }: { status: ItemStatus; size?: BadgeProps["size"]; className?: string }) {
  return <Badge variant={STATUS_VARIANT[status]} size={size} className={className}>{STATUS_LABEL[status]}</Badge>;
}

export { Badge, badgeVariants, DifficultyBadge, StatusBadge };
