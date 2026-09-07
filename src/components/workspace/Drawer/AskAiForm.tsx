"use client";
/** "✨ Ask AI for a specific problem" (Module 03 §1.10): v1's prompt box, now streaming stages inline. */
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { quotaLeft, useMe } from "@/store/me";
import { useNextProblem } from "@/components/workspace/hooks/useNextProblem";
import { GenerationStages } from "@/components/workspace/Drawer/GenerationStages";

export function AskAiForm() {
  const nav = useNextProblem();
  const generation = useWorkspace((s) => s.generation);
  const me = useMe((s) => s.me);
  const [prompt, setPrompt] = useState("");
  const left = quotaLeft(me, "generate");

  if (!nav.hasProject) return null;
  if (generation.active || generation.error) return <div className="h-48"><GenerationStages compact /></div>;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const p = prompt.trim(); if (p) { void nav.generate(p); setPrompt(""); } }}
      className="space-y-2"
    >
      <label htmlFor="ask-ai" className="flex items-center gap-1.5 text-xs font-medium text-fg-2"><Sparkles className="size-3.5 text-brand-to" /> Ask AI for a specific problem</label>
      <div className="flex items-center gap-2">
        <input
          id="ask-ai"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={300}
          placeholder="e.g. hard graph, medium sliding window…"
          className="h-9 flex-1 rounded-[8px] bg-fg-1/[0.07] px-3 text-sm text-fg-1 outline-none placeholder:text-fg-3 focus-visible:ring-2 focus-visible:ring-brand-from/50"
        />
        <button type="submit" disabled={!prompt.trim() || left <= 0} className="bg-brand flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          {generation.active ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate
        </button>
      </div>
      <p className="text-[11px] text-fg-3">{left <= 0 ? "No AI generations left today — pool problems are still unlimited." : Number.isFinite(left) ? `${left} AI generations left today · verified before you see it` : "Verified on the judge before you see it"}</p>
    </form>
  );
}
