"use client";
/** Step through: scrubber, playback, jump buttons and chapter strip (Module 07 V-14). */
import { useMemo } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, CornerDownRight, Pause, Play, PhoneIncoming, SkipBack, SkipForward } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { chapters as deriveChapters, findStep } from "@/lib/trace/replay";
import type { Trace } from "@/lib/trace/types";
import { useTrace, type PlaybackSpeed } from "@/store/trace";

const SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 4];
const btn = "flex size-7 items-center justify-center rounded-[5px] text-fg-2 transition-colors hover:bg-ws-hover hover:text-fg-1 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60";

export function Timeline({ trace }: { trace: Trace }) {
  const cursor = useTrace((s) => s.cursor);
  const setCursor = useTrace((s) => s.setCursor);
  const playing = useTrace((s) => s.playing);
  const setPlaying = useTrace((s) => s.setPlaying);
  const speed = useTrace((s) => s.speed);
  const setSpeed = useTrace((s) => s.setSpeed);
  const selected = useTrace((s) => s.selected);
  const n = trace.steps.length;
  const last = Math.max(0, n - 1);
  const chapterList = useMemo(() => deriveChapters(trace).filter((c) => c.kind === "call" || c.kind === "loop"), [trace]);
  const current = trace.steps[cursor];
  const failureStep = trace.divergeAt ?? trace.exception?.step;

  const jump = (dir: 1 | -1, pred: Parameters<typeof findStep>[3]) => { const i = findStep(trace, cursor, dir, pred); if (i !== null) setCursor(i); };
  const nextChange = () => {
    if (!selected) return jump(1, (s) => s.changed.length > 0);
    jump(1, (s) => s.changed.some((c) => c === selected || c.endsWith(`:${selected}`)));
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-line bg-ws-bar px-2 py-1.5">
      <div className="flex items-center gap-1">
        <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => setCursor(0)} disabled={cursor === 0} aria-label="First step" className={btn}><SkipBack className="size-4" /></button></TooltipTrigger><TooltipContent side="top">First step</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => setCursor(cursor - 1)} disabled={cursor === 0} aria-label="Previous step" className={btn}><ChevronLeft className="size-4" /></button></TooltipTrigger><TooltipContent side="top">Previous step ←</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild>
          <button type="button" onClick={() => { if (cursor >= last) setCursor(0); setPlaying(!playing); }} aria-label={playing ? "Pause" : "Play"} className={cn(btn, "bg-brand-from/15 text-brand-to hover:bg-brand-from/25")}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
        </TooltipTrigger><TooltipContent side="top">{playing ? "Pause (space)" : "Play (space)"}</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => setCursor(cursor + 1)} disabled={cursor >= last} aria-label="Next step" className={btn}><ChevronRight className="size-4" /></button></TooltipTrigger><TooltipContent side="top">Next step →</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => setCursor(last)} disabled={cursor >= last} aria-label="Last step" className={btn}><SkipForward className="size-4" /></button></TooltipTrigger><TooltipContent side="top">Last step</TooltipContent></Tooltip>
        <span className="h-4 w-px bg-line/70" />
        <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => jump(1, (s) => s.ev === "call")} aria-label="Next call" className={btn}><PhoneIncoming className="size-4" /></button></TooltipTrigger><TooltipContent side="top">Next function call</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => jump(1, (s) => s.ev === "return")} aria-label="Next return" className={btn}><CornerDownRight className="size-4" /></button></TooltipTrigger><TooltipContent side="top">Next return</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><button type="button" onClick={nextChange} aria-label="Next change" className={cn(btn, "px-1.5 text-[11px] font-medium")}>Δ{selected ? " sel" : ""}</button></TooltipTrigger><TooltipContent side="top">{selected ? `Next change of the selected value` : "Next change of anything (select a value to narrow)"}</TooltipContent></Tooltip>
        {failureStep !== undefined && (
          <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => setCursor(failureStep)} aria-label="Jump to failure" className={cn(btn, "text-wrong hover:text-wrong")}><AlertTriangle className="size-4" /></button></TooltipTrigger><TooltipContent side="top">{trace.exception ? "Jump to the exception" : "Jump to where the output stopped matching"}</TooltipContent></Tooltip>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="font-mono text-[11px] tabular-nums text-fg-2">step {cursor + 1}/{n}{current ? ` · line ${current.line}` : ""}</span>
          <select aria-label="Playback speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value) as PlaybackSpeed)} className="h-7 rounded-[5px] border border-line bg-ws-panel px-1 text-[11px] text-fg-1">
            {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </div>
      </div>
      <div className="relative">
        <input
          type="range" min={0} max={last} value={cursor} onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }}
          aria-label="Trace position" className="trace-scrubber w-full"
        />
        {failureStep !== undefined && n > 1 && <span aria-hidden className="pointer-events-none absolute top-0 h-full w-0.5 bg-wrong" style={{ left: `calc(${(failureStep / last) * 100}% )` }} />}
      </div>
      {chapterList.length > 0 && n > 1 && (
        <div className="ws-scroll flex gap-1 overflow-x-auto pb-0.5" role="list" aria-label="Chapters">
          {chapterList.slice(0, 200).map((c, i) => {
            const on = cursor >= c.from && cursor <= c.to;
            return (
              <button key={i} type="button" role="listitem" onClick={() => setCursor(c.from)} className={cn("h-5 shrink-0 rounded-[4px] px-1.5 font-mono text-[10px] transition-colors", c.kind === "call" ? "bg-brand-from/10 text-brand-to" : "bg-ws-panel text-fg-2", on && "ring-1 ring-brand-from/70 text-fg-1")} style={{ marginLeft: c.depth > 1 ? 0 : undefined }}>
                {c.kind === "loop" ? "↻ " : ""}{c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
