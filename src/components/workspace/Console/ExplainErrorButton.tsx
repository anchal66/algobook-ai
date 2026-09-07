"use client";
/** "✨ Explain this error" (Module 03 W-11): AI explanation of a compile / runtime error, Pro-gated (hint3 quota). */
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { ApiError, explainError } from "@/lib/workspace/api";
import { useWorkspace } from "@/store/workspace";
import { useMe } from "@/store/me";
import { StatementMarkdown } from "@/components/workspace/Description/StatementMarkdown";

export function ExplainErrorButton({ output }: { output: string }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; text?: string }>({ status: "idle" });
  const bumpQuota = useMe((s) => s.bumpQuota);

  const explain = async () => {
    const ws = useWorkspace.getState();
    if (!ws.problem) return;
    setState({ status: "loading" });
    try {
      const res = await explainError(ws.problem.id, ws.language, ws.code[ws.language] ?? "", output.slice(0, 20_000));
      bumpQuota("hint3");
      setState({ status: "done", text: res.explanation });
    } catch (e) {
      const msg = e instanceof ApiError ? (e.code === "PAYMENT_REQUIRED" ? "Error explanations are part of the Pro plan." : e.code === "QUOTA_EXCEEDED" ? "You have used today's AI explanations." : e.message) : "Could not explain this error";
      setState({ status: "error", text: msg });
    }
  };

  if (state.status === "done") {
    return (
      <div className="mt-3 rounded-[8px] border border-brand-from/30 bg-brand-from/10 p-3 text-sm">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-brand-to"><Sparkles className="size-3.5" /> AlgoBook AI</p>
        <StatementMarkdown markdown={state.text ?? ""} />
      </div>
    );
  }
  return (
    <div className="mt-3">
      <button type="button" onClick={() => void explain()} disabled={state.status === "loading"} className="flex h-8 items-center gap-1.5 rounded-[6px] bg-brand-from/15 px-3 text-xs font-medium text-brand-to transition-colors hover:bg-brand-from/25 disabled:opacity-60">
        {state.status === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Explain this error
      </button>
      {state.status === "error" && <p className="mt-2 text-xs text-wrong" role="alert">{state.text}</p>}
    </div>
  );
}
