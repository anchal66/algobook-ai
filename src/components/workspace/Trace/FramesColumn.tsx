"use client";
/** "Where we are": the call stack with locals, change flashes and a recursion call tree (Module 07 V-10). */
import { useMemo } from "react";
import { CornerDownRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatValue } from "@/lib/trace/replay";
import { isRef, type Step, type Trace, type TraceState, type Value } from "@/lib/trace/types";
import { useTrace } from "@/store/trace";

export interface FramesColumnProps { trace: Trace; state: TraceState; step: Step; prev: TraceState | null }

function ValueChip({ v, heap, changed, onSelect, selected }: { v: Value; heap: TraceState["heap"]; changed: boolean; onSelect?: (id: string) => void; selected?: boolean }) {
  const text = formatValue(v, heap);
  if (isRef(v)) {
    return (
      <button type="button" onClick={() => onSelect?.(v.ref)} title={`Show ${v.ref} in memory`} className={cn("max-w-full truncate rounded-[4px] px-1.5 py-0.5 text-left font-mono text-[12px] transition-colors", selected ? "bg-brand-from/25 text-fg-1" : "bg-brand-from/10 text-brand-to hover:bg-brand-from/20", changed && "trace-flash")}>
        {text}
      </button>
    );
  }
  return <span className={cn("rounded-[4px] px-1 font-mono text-[12px] text-fg-1", changed && "trace-flash bg-medium/20")}>{text}</span>;
}

export function FramesColumn({ trace, state, step, prev }: FramesColumnProps) {
  const selected = useTrace((s) => s.selected);
  const setSelected = useTrace((s) => s.setSelected);
  const changed = useMemo(() => new Set(step.changed), [step]);
  const frames = [...state.stack].reverse();

  return (
    <div className="ws-scroll flex h-full flex-col gap-2 overflow-y-auto p-2">
      <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-fg-3"><Layers className="size-3.5" /> Where we are · {state.stack.length} {state.stack.length === 1 ? "frame" : "frames"}</p>
      {frames.length === 0 && <p className="px-1 text-xs text-fg-3">The harness is calling your function…</p>}
      {frames.map((f, idx) => {
        const locals = state.locals[String(f.id)] ?? {};
        const prevLocals = prev?.locals[String(f.id)];
        const isTop = idx === 0;
        return (
          <div key={f.id} className={cn("rounded-[8px] border p-2 transition-colors", isTop ? "border-brand-from/50 bg-brand-from/[0.06]" : "border-line bg-ws-bar")}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[12px] font-semibold text-fg-1">{f.fn}()</span>
              <span className="shrink-0 text-[11px] text-fg-3">{isTop ? `line ${step.line}` : `waiting at line ${f.line}`}{state.stack.length - idx > 1 ? ` · depth ${state.stack.length - idx}` : ""}</span>
            </div>
            {isTop && step.ev === "return" && step.ret !== undefined && (
              <p className="mb-1 flex items-center gap-1 text-[12px] text-accepted"><CornerDownRight className="size-3.5" /> returns <span className="font-mono">{formatValue(step.ret, state.heap)}</span></p>
            )}
            {isTop && step.ev === "exception" && step.exc && (
              <p className="mb-1 text-[12px] text-wrong">raises <span className="font-mono">{step.exc.type}</span>: {step.exc.message}</p>
            )}
            {Object.keys(locals).length === 0 ? <p className="text-[11px] text-fg-3">no variables yet</p> : (
              <table className="w-full border-separate border-spacing-y-0.5">
                <tbody>
                  {Object.entries(locals).map(([name, v]) => {
                    const key = `${f.id}:${name}`;
                    const was = prevLocals?.[name];
                    const isChanged = changed.has(key) && prev !== null && JSON.stringify(was) !== JSON.stringify(v);
                    return (
                      <tr key={name}>
                        <td className="w-[38%] truncate pr-2 align-top font-mono text-[12px] text-fg-2">{name}</td>
                        <td className="align-top">
                          <div className="flex flex-wrap items-center gap-1">
                            <ValueChip v={v} heap={state.heap} changed={isChanged} onSelect={setSelected} selected={isRef(v) && selected === v.ref} />
                            {isChanged && was !== undefined && !isRef(v) && <span className="font-mono text-[11px] text-fg-3 line-through">{formatValue(was, prev?.heap)}</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
      {trace.entry && (
        <div className="mt-auto rounded-[8px] border border-dashed border-line p-2 text-[11px] text-fg-3">
          Test harness → <span className="font-mono text-fg-2">{trace.entry.fn}({Object.entries(trace.entry.args).map(([k, v]) => `${k}=${formatValue(v, trace.steps[0]?.heap ? Object.fromEntries(Object.entries(trace.steps[0].heap).filter(([, o]) => o) as [string, NonNullable<Step["heap"]>[string]][]) as TraceState["heap"] : undefined)}`).join(", ")})</span>
        </div>
      )}
    </div>
  );
}
