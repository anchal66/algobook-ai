"use client";
/** One case's Input / Output / Expected / Stderr / compile output (Module 03 §1.8, W-11). */
import { toHuman } from "@/lib/judge/human";
import { cn } from "@/lib/utils";
import type { CaseResult, ProblemParam } from "@/types";
import { ParamInput } from "@/components/workspace/Console/ParamInput";
import { ExplainErrorButton } from "@/components/workspace/Console/ExplainErrorButton";

export interface CaseResultViewProps {
  params: ProblemParam[];
  result: CaseResult;
  /** Custom cases show output only (no Expected). */
  custom?: boolean;
  /** Hidden cases (from Submit) show the input but say so. */
  hidden?: boolean;
}

export function OutputBlock({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "error" }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-fg-3">{label}</p>
      <pre className={cn("ws-scroll max-h-56 overflow-auto whitespace-pre-wrap rounded-[8px] px-3 py-2 font-mono text-[13px] leading-5", tone === "error" ? "bg-wrong/10 text-wrong" : "bg-fg-1/[0.07] text-fg-1")}>{value || " "}</pre>
    </div>
  );
}

export function CaseResultView({ params, result, custom, hidden }: CaseResultViewProps) {
  const inputs = toHuman(params, result.input);
  const isCE = result.status === "CE";
  const isRE = result.status === "RE" || result.status === "MLE" || result.status === "IE";
  return (
    <div className="space-y-3">
      {isCE && result.compileOutput && (
        <div>
          <OutputBlock label="Compile output" value={result.compileOutput} tone="error" />
          <ExplainErrorButton output={result.compileOutput} />
        </div>
      )}
      {!isCE && (
        <div className="space-y-3">
          <p className="text-xs text-fg-3">Input{hidden ? " (hidden test)" : ""}</p>
          {params.map((p, i) => <ParamInput key={p.name} name={p.name} type={p.type} value={inputs[i] ?? ""} readOnly />)}
        </div>
      )}
      {!isCE && (isRE || result.status === "TLE") && result.stderr && (
        <div>
          <OutputBlock label={result.status === "TLE" ? "Stderr" : "Stderr"} value={result.stderr} tone="error" />
          <ExplainErrorButton output={result.stderr} />
        </div>
      )}
      {!isCE && (
        <OutputBlock label={custom ? "Output" : "Output"} value={result.actual} />
      )}
      {!isCE && !custom && result.expected !== null && <OutputBlock label="Expected" value={result.expected} />}
      {result.status === "TLE" && <p className="text-xs text-fg-3">Your code took longer than the time limit on this input.</p>}
    </div>
  );
}
