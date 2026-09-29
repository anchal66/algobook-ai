"use client";
/** Console → Visualize tab (Module 07 V-08): idle / preparing / loading Python / running / error / the trace view. */
import dynamic from "next/dynamic";
import { Loader2, Play, ScanEye } from "lucide-react";
import { useTrace } from "@/store/trace";
import { useWorkspace } from "@/store/workspace";
import { canVisualize, useVisualize } from "@/components/workspace/hooks/useVisualize";
import { useMediaQuery } from "@/components/workspace/hooks/useMediaQuery";

const TraceView = dynamic(() => import("@/components/workspace/Trace/TraceView").then((m) => m.TraceView), { ssr: false, loading: () => <Centered><Loader2 className="size-5 animate-spin text-fg-3" /></Centered> });

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">{children}</div>;
}

export function TraceTab() {
  const status = useTrace((s) => s.status);
  const progress = useTrace((s) => s.progress);
  const error = useTrace((s) => s.error);
  const trace = useTrace((s) => s.trace);
  const language = useWorkspace((s) => s.language);
  const problem = useWorkspace((s) => s.problem);
  const { visualize } = useVisualize();
  const narrow = useMediaQuery("(max-width: 1023px)");

  if (narrow) return <Centered><ScanEye className="size-6 text-fg-3" /><p className="text-sm text-fg-2">The visualizer needs a wider screen.</p><p className="text-xs text-fg-3">Open this problem on a laptop or desktop to watch your code run.</p></Centered>;
  if (!problem) return <Centered><p className="text-sm text-fg-3">Load a problem first.</p></Centered>;
  if (!canVisualize(language)) return <Centered><ScanEye className="size-6 text-fg-3" /><p className="text-sm text-fg-2">Visualize is available for Python and JavaScript.</p><p className="max-w-sm text-xs text-fg-3">Switch the language to watch your code run line by line. Java and C++ support is planned.</p></Centered>;

  if (status === "preparing" || status === "loading" || status === "running") {
    return (
      <Centered>
        <Loader2 className="size-5 animate-spin text-brand-to" />
        <p className="text-sm text-fg-1">{status === "preparing" ? "Preparing the harness…" : status === "loading" ? (progress?.detail ?? "Loading the runtime…") : "Running your code step by step…"}</p>
        {status === "loading" && trace === null && language === "python" && <p className="max-w-sm text-xs text-fg-3">The Python runtime (~7 MB) downloads once per session and is cached by your browser afterwards.</p>}
      </Centered>
    );
  }
  if (status === "error" && error) {
    return (
      <Centered>
        <p className="text-sm font-medium text-wrong">Could not visualize</p>
        <p className="max-w-md text-xs text-fg-2" role="alert">{error.message}{error.line ? ` (line ${error.line})` : ""}</p>
        <button type="button" onClick={() => void visualize()} className="mt-1 flex h-8 items-center gap-1.5 rounded-[6px] bg-brand-from/15 px-3 text-xs font-medium text-brand-to hover:bg-brand-from/25"><Play className="size-3.5" /> Try again</button>
      </Centered>
    );
  }
  if (!trace) {
    return (
      <Centered>
        <ScanEye className="size-6 text-brand-to" />
        <p className="text-sm text-fg-1">Watch your code run, line by line.</p>
        <p className="max-w-sm text-xs text-fg-3">Runs the selected test case through your code in your browser and replays every step: variables, arrays, maps, linked lists, trees and the call stack.</p>
        <button type="button" onClick={() => void visualize()} className="mt-1 flex h-8 items-center gap-1.5 rounded-[6px] bg-brand-from/15 px-3 text-xs font-medium text-brand-to hover:bg-brand-from/25"><Play className="size-3.5" /> Visualize the current case</button>
      </Centered>
    );
  }
  return <TraceView trace={trace} onRerun={() => void visualize(useTrace.getState().caseIndex)} />;
}
