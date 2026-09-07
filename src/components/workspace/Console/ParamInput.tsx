"use client";
/** `nums =` label + editable monospace box with inline validation (Module 03 §1.8). */
import { useId } from "react";
import { cn } from "@/lib/utils";

export interface ParamInputProps {
  name: string;
  type: string;
  value: string;
  error?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}

export function ParamInput({ name, type, value, error, readOnly, onChange }: ParamInputProps) {
  const id = useId();
  const multiline = value.includes("\n") || value.length > 60;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-fg-3">
        {name} =<span className="ml-1 text-fg-3/70">{type}</span>
      </label>
      <textarea
        id={id}
        value={value}
        readOnly={readOnly}
        rows={multiline ? 3 : 1}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange?.(e.target.value)}
        aria-invalid={!!error}
        className={cn(
          "ws-scroll block w-full resize-y rounded-[8px] bg-fg-1/[0.07] px-3 py-2 font-mono text-[13px] leading-5 text-fg-1 outline-none transition-shadow placeholder:text-fg-3 focus-visible:ring-2 focus-visible:ring-brand-from/50",
          readOnly && "cursor-default resize-none",
          error && "ring-2 ring-wrong/60",
        )}
      />
      {error && <p className="text-xs text-wrong" role="alert">{error}</p>}
    </div>
  );
}
