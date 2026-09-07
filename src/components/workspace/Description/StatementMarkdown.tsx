"use client";
/**
 * Markdown pipeline for statements, hints, editorials and chat (Module 03 W-05): remark-gfm,
 * remark-math + rehype-katex, LeetCode-style inline code chips, `10^4` → superscript.
 */
import { memo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

/** Turns `10^4`, `2^31`, `10^-5` outside code/math into KaTeX so they render as superscripts. */
export function superscriptExponents(md: string): string {
  const parts = md.split(/(```[\s\S]*?```|`[^`\n]*`|\$[^$\n]+\$)/g);
  return parts.map((p, i) => (i % 2 === 1 ? p : p.replace(/(?<![\w$])(-?\d+(?:\.\d+)?)\^(-?\d+)(?!\w)/g, (_m, b: string, e: string) => `$${b}^{${e}}$`))).join("");
}

/** Renders `10^4` inside plain text (e.g. constraints) as real superscripts. */
export function SupText({ text }: { text: string }): ReactNode {
  const parts = text.split(/(-?\d+(?:\.\d+)?\^-?\d+)/g);
  return parts.map((p, i) => {
    const m = p.match(/^(-?\d+(?:\.\d+)?)\^(-?\d+)$/);
    return m ? <span key={i}>{m[1]}<sup>{m[2]}</sup></span> : <span key={i}>{p}</span>;
  });
}

export const CODE_CHIP = "rounded-[5px] border border-fg-1/10 bg-fg-1/[0.07] px-1.5 py-0.5 font-mono text-[12px] text-fg-1/80 whitespace-pre-wrap";

const components: Components = {
  p: ({ children }) => <p className="my-3 leading-relaxed text-fg-1 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-fg-1">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-6">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h3 className="mt-5 mb-2 text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-5 mb-2 text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-4 mb-2 text-sm font-semibold">{children}</h4>,
  a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-brand-to underline underline-offset-2">{children}</a>,
  blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-line pl-3 text-fg-2">{children}</blockquote>,
  table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="min-w-full border-collapse text-sm">{children}</table></div>,
  th: ({ children }) => <th className="border border-line bg-ws-bar px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-line px-2 py-1">{children}</td>,
  hr: () => <hr className="my-4 border-line" />,
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "") || String(children).includes("\n");
    if (isBlock) return <code className={cn("font-mono text-[13px]", className)}>{children}</code>;
    return <code className={CODE_CHIP}>{children}</code>;
  },
  pre: ({ children }) => <pre className="ws-scroll my-3 overflow-x-auto rounded-[8px] bg-fg-1/[0.06] p-3 font-mono text-[13px] leading-relaxed text-fg-1">{children}</pre>,
};

export const StatementMarkdown = memo(function StatementMarkdown({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={cn("text-sm", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {superscriptExponents(markdown)}
      </ReactMarkdown>
    </div>
  );
});
