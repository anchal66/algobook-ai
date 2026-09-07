"use client";
/** `Example N:` block (Module 03 §1.3): 4 px left border, bg-2, monospace Input / Output / Explanation. */
import type { Example, ProblemParam } from "@/types";
import { encodeInput, parseInput } from "@/lib/judge/stdin";
import { toHuman } from "@/lib/judge/human";
import { SupText } from "@/components/workspace/Description/StatementMarkdown";

/** Module 02 stores example inputs as canonical stdin; show them LeetCode-style (`nums = [..], gap = 3`) when they round-trip. */
export function humanizeExampleInput(params: ProblemParam[], input: string): string {
  if (input.includes("=")) return input;
  try {
    const values = parseInput(params, input);
    const norm = (s: string) => s.replace(/\r\n?/g, "\n").replace(/\s+$/, "");
    if (norm(encodeInput(params, values)) !== norm(input)) return input;
    const human = toHuman(params, input);
    return params.map((p, i) => `${p.name} = ${human[i]}`).join(", ");
  } catch {
    return input;
  }
}

export function ExampleBlock({ index, example, params }: { index: number; example: Example; params: ProblemParam[] }) {
  const input = humanizeExampleInput(params, example.input);
  return (
    <section className="my-4" aria-label={`Example ${index}`}>
      <p className="mb-2 text-sm font-semibold text-fg-1">Example {index}:</p>
      <pre className="ws-scroll overflow-x-auto whitespace-pre-wrap rounded-r-[6px] border-l-[3px] border-fg-1/20 bg-fg-1/[0.06] px-4 py-3 font-mono text-[13px] leading-relaxed text-fg-1/70">
        <span className="font-semibold text-fg-1">Input: </span>{input}
        {"\n"}
        <span className="font-semibold text-fg-1">Output: </span>{example.output}
        {example.explanation?.trim() ? <>{"\n"}<span className="font-semibold text-fg-1">Explanation: </span><SupText text={example.explanation.trim()} /></> : null}
      </pre>
    </section>
  );
}
