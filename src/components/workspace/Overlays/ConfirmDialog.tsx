"use client";
/** Confirm dialog with LeetCode's exact copy for reset / load-solution (Module 03 W-25). */
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export const RESET_CODE_COPY = "Your current code will be discarded and reset to the default code!";
export const LOAD_CODE_COPY = "Your code will be discarded and replaced with this code!";

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showClose={false}>
        <DialogHeader>
          <DialogTitle>{title ?? "Are you sure?"}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="h-9 rounded-[8px] px-4 text-sm font-medium text-fg-2 hover:bg-ws-hover hover:text-fg-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60">
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => { onConfirm(); onOpenChange(false); }}
            className={cn("h-9 rounded-[8px] px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60", destructive ? "bg-wrong hover:bg-wrong/90" : "bg-brand hover:opacity-90")}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
