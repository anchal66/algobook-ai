import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Restyled shadcn Card (Module 05 U-03): flat 1px-border surface, `glow` gradient border on hover, `interactive` lift. */
const cardVariants = cva("flex flex-col rounded-card border border-line bg-card text-card-foreground", {
  variants: {
    variant: {
      flat: "",
      glow: "glow-card transition-shadow duration-200 hover:shadow-[0_12px_40px_-24px_rgba(99,102,241,0.6)]",
      ghost: "border-transparent bg-transparent",
      soft: "border-transparent bg-surface-2",
    },
    padding: { none: "", sm: "p-4", md: "p-5", lg: "p-6" },
    interactive: { true: "cursor-pointer transition-[transform,border-color,box-shadow] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-line-strong", false: "" },
  },
  defaultVariants: { variant: "flat", padding: "none", interactive: false },
});

export interface CardProps extends React.ComponentProps<"div">, VariantProps<typeof cardVariants> {}

function Card({ className, variant, padding, interactive, ...props }: CardProps) {
  return <div data-slot="card" className={cn(cardVariants({ variant, padding, interactive }), className)} {...props} />;
}
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)} {...props} />;
}
function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("text-md font-semibold leading-tight tracking-tight", className)} {...props} />;
}
function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-sm text-text-2", className)} {...props} />;
}
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("ml-auto shrink-0", className)} {...props} />;
}
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-5 pb-5", className)} {...props} />;
}
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center gap-3 border-t border-line px-5 py-3", className)} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent, cardVariants };
