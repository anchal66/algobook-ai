"use client";
/** The visualizer layout (Module 07 §3.5): code | frames | memory, with the timeline, output strip and AI narration below. */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Replayer, findStep } from "@/lib/trace/replay";
import type { Trace } from "@/lib/trace/types";
import { useTrace } from "@/store/trace";
import { useWorkspace } from "@/store/workspace";
import { TraceCode } from "@/components/workspace/Trace/TraceCode";
import { FramesColumn } from "@/components/workspace/Trace/FramesColumn";
import { MemoryCanvas } from "@/components/workspace/Trace/MemoryCanvas";
import { Timeline } from "@/components/workspace/Trace/Timeline";
import { ExplainPanel } from "@/components/workspace/Trace/ExplainPanel";
import { traceSourceKey } from "@/components/workspace/hooks/useVisualize";

const BASE_MS = 700;

export function TraceView({ trace, onRerun }: { trace: Trace; onRerun: () => void }) {
  const cursor = useTrace((s) => s.cursor);
  const setCursor = useTrace((s) => s.setCursor);
  const playing = useTrace((s) => s.playing);
  const setPlaying = useTrace((s) => s.setPlaying);
  const speed = useTrace((s) => s.speed);
  const breakpoints = useTrace((s) => s.breakpoints);
  const code = useTrace((s) => s.code);
  const caseIndex = useTrace((s) => s.caseIndex);
  const sourceKey = useTrace((s) => s.sourceKey);
  const problem = useWorkspace((s) => s.problem);
  const liveCode = useWorkspace((s) => s.code[s.language] ?? "");
  const language = useWorkspace((s) => s.language);
  const cases = useWorkspace((s) => s.cases);
  const stale = sourceKey !== null && sourceKey !== traceSourceKey(language, liveCode, caseIndex, cases[caseIndex]?.values ?? []);

  const replayer = useMemo(() => new Replayer(trace), [trace]);
  const state = useMemo(() => {
    const s = replayer.at(cursor);
    // clone shallowly so React sees a new object every step (the replayer mutates in place)
    return { stack: s.stack, locals: s.locals, heap: s.heap, stdout: s.stdout };
  }, [replayer, cursor]);
  const prev = useMemo(() => (cursor > 0 ? new Replayer(trace).at(cursor - 1) : null), [trace, cursor]);
  const step = trace.steps[cursor];
  const paramTypes = useMemo(() => Object.fromEntries((problem?.params ?? []).map((p) => [p.name, p.type])), [problem]);

  // playback
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const s = useTrace.getState();
      if (!s.trace) return;
      const next = s.cursor + 1;
      if (next >= s.trace.steps.length) { s.setPlaying(false); return; }
      s.setCursor(next);
      const st = s.trace.steps[next];
      if (st.ev === "line" && s.breakpoints.includes(st.line)) { s.setPlaying(false); return; }
      if (st.ev === "exception") { s.setPlaying(false); return; }
      timer.current = setTimeout(tick, BASE_MS / s.speed);
    };
    timer.current = setTimeout(tick, BASE_MS / speed);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, speed, breakpoints]);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
    if (e.key === "ArrowRight") { e.preventDefault(); setPlaying(false); setCursor(cursor + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setPlaying(false); setCursor(cursor - 1); }
    else if (e.key === " ") { e.preventDefault(); setPlaying(!playing); }
    else if (e.key === "Home") { e.preventDefault(); setCursor(0); }
    else if (e.key === "End") { e.preventDefault(); setCursor(trace.steps.length - 1); }
  }, [cursor, playing, setCursor, setPlaying, trace.steps.length]);

  const jumpToLine = useCallback((line: number) => {
    const next = findStep(trace, cursor, 1, (s) => s.line === line) ?? findStep(trace, -1, 1, (s) => s.line === line);
    if (next !== null) { setPlaying(false); setCursor(next); }
  }, [trace, cursor, setCursor, setPlaying]);

  if (!step) return null;
  const expected = trace.expected;
  const out = state.stdout;
  const diverged = trace.divergeAt !== undefined && cursor >= trace.divergeAt;

  return (
    <div className="flex h-full min-h-0 flex-col outline-none" tabIndex={0} onKeyDown={onKey} aria-label="Visualizer">
      {(stale || trace.truncated) && (
        <div className={cn("flex items-center gap-2 border-b border-line px-3 py-1 text-[12px]", stale ? "bg-medium/10 text-fg-1" : "bg-ws-bar text-fg-2")}>
          {stale ? <><RefreshCw className="size-3.5 text-medium" /> The code or the test case changed since this run.<button type="button" onClick={onRerun} className="ml-1 font-medium text-brand-to hover:underline">Visualize again</button></>
            : <><AlertTriangle className="size-3.5 text-medium" /> {trace.truncated === "steps" ? "Stopped after 3,000 steps — the picture below covers the beginning. Try a smaller custom test case to see everything." : trace.truncated === "time" ? "Stopped after 5 seconds. Try a smaller custom test case." : "Too many objects to draw — some are omitted."}</>}
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,5fr)_minmax(220px,3fr)_minmax(260px,5fr)] divide-x divide-line">
        <div className="min-h-0 min-w-0"><TraceCode trace={trace} code={code} cursor={cursor} onJumpToLine={jumpToLine} /></div>
        <div className="min-h-0 min-w-0"><FramesColumn trace={trace} state={state} step={step} prev={prev} /></div>
        <div className="min-h-0 min-w-0"><MemoryCanvas state={state} step={step} prev={prev} code={code} paramTypes={paramTypes} /></div>
      </div>
      <div className="flex items-stretch gap-2 border-t border-line bg-ws-bar px-2 py-1.5 text-[12px]">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-fg-3">Output so far</p>
          <pre className={cn("ws-scroll max-h-12 overflow-auto whitespace-pre-wrap font-mono text-[12px] text-fg-1", diverged && "text-wrong")}>{out || " "}</pre>
        </div>
        {expected !== undefined && (
          <div className="min-w-0 flex-1 border-l border-line pl-2">
            <p className="text-[10px] uppercase tracking-wide text-fg-3">Expected</p>
            <pre className="ws-scroll max-h-12 overflow-auto whitespace-pre-wrap font-mono text-[12px] text-fg-2">{expected}</pre>
          </div>
        )}
        {trace.exception && (
          <div className="min-w-0 flex-1 border-l border-line pl-2">
            <p className="text-[10px] uppercase tracking-wide text-wrong">Exception</p>
            <pre className="ws-scroll max-h-12 overflow-auto whitespace-pre-wrap font-mono text-[12px] text-wrong">{trace.exception.type}: {trace.exception.message}</pre>
          </div>
        )}
      </div>
      <Timeline trace={trace} />
      <ExplainPanel trace={trace} />
    </div>
  );
}
