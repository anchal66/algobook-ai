"use client";
/**
 * Drag handle between panels (Module 03 §1.2): 8 px hit area, 2 px visible line, accent on hover/drag,
 * double-click resets the split. When "Real-time resizing" is off, a ghost line follows the pointer and
 * the layout is applied on release.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { DEFAULT_LAYOUTS, getGroup, getGroupElement } from "@/components/workspace/Layout/layoutRegistry";

export interface ResizeHandleProps {
  groupId: string;
  before: string;
  after: string;
  orientation: "horizontal" | "vertical";
  lazy: boolean;
}

const MIN_PCT = 5;

export function ResizeHandle({ groupId, before, after, orientation, lazy }: ResizeHandleProps) {
  const horizontal = orientation === "horizontal";
  const [active, setActive] = useState(false);
  const [ghost, setGhost] = useState<number | null>(null);
  const drag = useRef<{ start: number; startLayout: Record<string, number>; size: number } | null>(null);

  const resetSplit = useCallback(() => {
    const g = getGroup(groupId);
    const def = DEFAULT_LAYOUTS[groupId];
    if (!g || !def) return;
    const cur = g.getLayout();
    const pair = (def[before] ?? 50) + (def[after] ?? 50);
    const curPair = (cur[before] ?? 0) + (cur[after] ?? 0);
    const scale = pair ? curPair / pair : 1;
    g.setLayout({ ...cur, [before]: (def[before] ?? 50) * scale, [after]: (def[after] ?? 50) * scale });
  }, [groupId, before, after]);

  useEffect(() => {
    if (!active) return;
    const up = () => setActive(false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [active]);

  const lineClass = cn(
    "rounded-full transition-colors duration-150",
    horizontal ? "h-full w-0.5" : "h-0.5 w-full",
    active ? "bg-brand-from" : "bg-transparent group-hover/handle:bg-brand-from",
  );

  if (!lazy) {
    return (
      <Separator
        className={cn("group/handle flex shrink-0 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60", horizontal ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize")}
        onPointerDown={() => setActive(true)}
        onDoubleClick={resetSplit}
      >
        <div className={lineClass} />
      </Separator>
    );
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = getGroup(groupId);
    const el = getGroupElement(groupId);
    if (!g || !el) return;
    const rect = el.getBoundingClientRect();
    drag.current = { start: horizontal ? e.clientX : e.clientY, startLayout: g.getLayout(), size: horizontal ? rect.width : rect.height };
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    setGhost(horizontal ? e.clientX : e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setGhost(horizontal ? e.clientX : e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    setActive(false);
    if (!d) return;
    const g = getGroup(groupId);
    if (!g || !d.size) return;
    const deltaPct = (((horizontal ? e.clientX : e.clientY) - d.start) / d.size) * 100;
    const a = d.startLayout[before] ?? 50, b = d.startLayout[after] ?? 50;
    const na = Math.min(a + b - MIN_PCT, Math.max(MIN_PCT, a + deltaPct));
    g.setLayout({ ...d.startLayout, [before]: na, [after]: a + b - na });
  };

  return (
    <>
      <Separator
        disabled
        className={cn("group/handle flex shrink-0 items-center justify-center outline-none", horizontal ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={resetSplit}
      >
        <div className={lineClass} />
      </Separator>
      {ghost !== null && (
        <div
          aria-hidden
          className={cn("pointer-events-none fixed z-50 bg-brand-from/80", horizontal ? "top-0 bottom-0 w-0.5" : "left-0 right-0 h-0.5")}
          style={horizontal ? { left: ghost } : { top: ghost }}
        />
      )}
    </>
  );
}
