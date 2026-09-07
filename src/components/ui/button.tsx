"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Restyled shadcn Button (Module 05 U-03): brand gradient primary, loading state, icon sizes. */
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-sm font-medium transition-[background-color,color,box-shadow,transform,opacity] duration-150 ease-out-quart outline-none select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-brand/40 aria-invalid:ring-err/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 active:translate-y-px",
  {
    variants: {
      variant: {
        brand: "bg-brand text-white shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_8px_24px_-12px_rgba(99,102,241,0.75)] hover:brightness-110 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_10px_28px_-10px_rgba(99,102,241,0.85)]",
        default: "bg-text-1 text-surface-0 hover:opacity-90",
        secondary: "bg-surface-2 text-text-1 hover:bg-surface-3",
        outline: "border border-line bg-transparent text-text-1 hover:bg-surface-2 hover:border-line-strong",
        ghost: "text-text-2 hover:bg-surface-2 hover:text-text-1",
        destructive: "bg-err text-white hover:bg-err/90 focus-visible:ring-err/30",
        link: "text-brand underline-offset-4 hover:underline h-auto p-0",
        success: "bg-ok text-white hover:bg-ok/90",
      },
      size: {
        default: "h-9 px-4",
        xs: "h-7 rounded-[6px] px-2.5 text-xs gap-1.5",
        sm: "h-8 rounded-[6px] px-3 text-sm gap-1.5",
        lg: "h-11 rounded-[10px] px-6 text-md",
        xl: "h-13 rounded-[12px] px-8 text-md",
        icon: "size-9",
        "icon-sm": "size-8 rounded-[6px]",
        "icon-xs": "size-7 rounded-[6px]",
        "icon-lg": "size-11 rounded-[10px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and disables the button while true. */
  loading?: boolean;
}

function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      data-loading={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? children : (
        <>
          {loading && <Loader2 className="absolute size-4 animate-spin" aria-hidden />}
          <span className={cn("contents", loading && "invisible")}>{children}</span>
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
