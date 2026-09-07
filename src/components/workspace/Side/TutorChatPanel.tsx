"use client";
/** AI tutor side panel (Module 03 W-20): SSE streaming replies, quick actions, quota indicator, scope note. */
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, chatStream } from "@/lib/workspace/api";
import { track } from "@/lib/analytics";
import { useWorkspace } from "@/store/workspace";
import { isPro, quotaLeft, useMe } from "@/store/me";
import { StatementMarkdown } from "@/components/workspace/Description/StatementMarkdown";

const QUICK = [
  { label: "Give me a hint", text: "Give me a small hint for my next step without revealing the solution." },
  { label: "Explain my error", text: "Here is my current code — explain what is wrong with it." },
  { label: "Is my approach right?", text: "Is the approach in my current code on the right track? Point out flaws without writing the solution." },
  { label: "Review my code", text: "Review my code for correctness, complexity and style." },
];

export function TutorChatPanel({ initialPrompt }: { initialPrompt?: string | null }) {
  const problem = useWorkspace((s) => s.problem);
  const chat = useWorkspace((s) => s.chat);
  const setChat = useWorkspace((s) => s.setChat);
  const me = useMe((s) => s.me);
  const bumpQuota = useMe((s) => s.bumpQuota);
  const pro = isPro(me);
  const left = quotaLeft(me, "chat");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const sentInitial = useRef(false);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [chat, streaming]);
  useEffect(() => () => abort.current?.abort(), []);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || !problem || streaming !== null) return;
    setError(null);
    const ws = useWorkspace.getState();
    const next = [...ws.chat, { role: "user" as const, content: t }].slice(-16);
    setChat(next);
    setInput("");
    setStreaming("");
    abort.current = new AbortController();
    try {
      const full = await chatStream(problem.id, next.slice(-8), { code: ws.code[ws.language], language: ws.language }, (d) => setStreaming((s) => (s ?? "") + d), abort.current.signal);
      setChat([...next, { role: "assistant", content: full }]);
      bumpQuota("chat");
      track("chat_msg", { length: t.length });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setError(e instanceof ApiError ? (e.code === "PAYMENT_REQUIRED" ? "The AI tutor is part of the Pro plan." : e.code === "QUOTA_EXCEEDED" ? "You have used today's tutor messages." : e.message) : "The tutor is unavailable right now");
      }
    } finally {
      setStreaming(null);
      abort.current = null;
    }
  };

  useEffect(() => {
    if (initialPrompt && !sentInitial.current && problem) { sentInitial.current = true; void send(initialPrompt); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, problem?.id]);

  if (!problem) return <p className="p-4 text-sm text-fg-3">Open a problem to chat with the tutor.</p>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-fg-3">
        <Sparkles className="size-3.5 text-brand-to" />
        <span>Scoped to <span className="text-fg-1">{problem.title}</span> — it sees your current code.</span>
        <span className="ml-auto whitespace-nowrap">{pro ? (Number.isFinite(left) ? `${left} left today` : "unlimited") : "Pro"}</span>
      </div>
      <div className="ws-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {chat.length === 0 && streaming === null && (
          <div className="rounded-[8px] bg-ws-bar p-3 text-sm text-fg-2">
            Ask about the approach, an error, or complexity. I won&apos;t hand over the full solution before you solve it — Socratic mode.
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={cn("max-w-[92%] rounded-[10px] px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-brand-from/20 text-fg-1" : "bg-ws-bar text-fg-1")}>
            {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <StatementMarkdown markdown={m.content} />}
          </div>
        ))}
        {streaming !== null && (
          <div className="max-w-[92%] rounded-[10px] bg-ws-bar px-3 py-2 text-sm text-fg-1">
            {streaming ? <StatementMarkdown markdown={streaming} /> : <Loader2 className="size-4 animate-spin text-fg-3" />}
          </div>
        )}
        {error && <p className="text-xs text-wrong" role="alert">{error}</p>}
        <div ref={bottom} />
      </div>
      <div className="border-t border-line/60 p-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {QUICK.map((q) => <button key={q.label} type="button" onClick={() => void send(q.text)} disabled={streaming !== null} className="h-6 rounded-full bg-ws-chip px-2.5 text-[11px] text-fg-2 hover:bg-ws-hover hover:text-fg-1 disabled:opacity-50">{q.label}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-end gap-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            rows={2}
            placeholder="Ask the tutor… (Enter to send)"
            className="ws-scroll min-h-0 flex-1 resize-none rounded-[8px] bg-fg-1/[0.07] px-3 py-2 text-sm text-fg-1 outline-none placeholder:text-fg-3 focus-visible:ring-2 focus-visible:ring-brand-from/50"
          />
          {streaming !== null ? (
            <button type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="flex size-9 items-center justify-center rounded-[8px] bg-ws-chip text-fg-1 hover:bg-ws-hover"><Square className="size-4" /></button>
          ) : (
            <button type="submit" disabled={!input.trim()} aria-label="Send" className="bg-brand flex size-9 items-center justify-center rounded-[8px] text-white disabled:opacity-50"><Send className="size-4" /></button>
          )}
        </form>
      </div>
    </div>
  );
}
