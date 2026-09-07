"use client";
/**
 * `Java ▾` language dropdown (Module 03 §1.7, D-01). A language without a verified driver shows
 * "Preparing…" and calls `/api/problems/:id/languages`, which waits for the in-flight generation.
 */
import { useCallback } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ApiError, ensureLanguage, getDraft, getProblem } from "@/lib/workspace/api";
import { readLocalDraft, resolveInitialCode } from "@/lib/workspace/drafts";
import { useWorkspace } from "@/store/workspace";
import { useSettings } from "@/store/settings";
import { useAuth } from "@/context/AuthContext";
import type { Language } from "@/types";

const LABELS: Record<Language, string> = { java: "Java", python: "Python3", cpp: "C++", javascript: "JavaScript" };
const ORDER: Language[] = ["java", "python", "cpp", "javascript"];

export function LanguageSelect({ onBeforeSwitch }: { onBeforeSwitch?: () => Promise<void> }) {
  const { user } = useAuth();
  const language = useWorkspace((s) => s.language);
  const languages = useWorkspace((s) => s.languages);
  const preparing = useWorkspace((s) => s.preparingLanguage);
  const problem = useWorkspace((s) => s.problem);
  const setEditor = useSettings((s) => s.setEditor);

  const switchTo = useCallback(async (lang: Language) => {
    const ws = useWorkspace.getState();
    const p = ws.problem;
    if (!p || lang === ws.language || ws.preparingLanguage) return;
    await onBeforeSwitch?.();
    let starter = p.starter[lang] ?? "";
    const ready = ws.languages.find((l) => l.key === lang)?.ready;
    if (!ready) {
      ws.setPreparingLanguage(lang);
      try {
        const res = await ensureLanguage(p.id, lang);
        if (res.status === "failed") throw new ApiError(409, "LANGUAGE_NOT_READY", "Could not prepare this language");
        if (res.status !== "ready" && res.status !== "done") { toast(`${LABELS[lang]} is still being prepared. Try again in a few seconds.`); ws.setPreparingLanguage(null); return; }
        starter = res.starter ?? starter;
        useWorkspace.getState().setLanguageReady(lang, starter);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : `Could not prepare ${LABELS[lang]}`);
        useWorkspace.getState().setPreparingLanguage(null);
        return;
      }
      useWorkspace.getState().setPreparingLanguage(null);
    }
    const cur = useWorkspace.getState();
    if (cur.code[lang] === undefined) {
      let server: { code: string; updatedAt: string } | null = null;
      try {
        // The problem was loaded with only the active language's starter; fetch this language's starter + draft.
        const res = await getProblem(p.id, lang);
        if (res.problem.starter[lang]) { starter = res.problem.starter[lang]!; useWorkspace.getState().setLanguageReady(lang, starter); }
        if (res.draft?.code?.[lang]) server = { code: res.draft.code[lang]!, updatedAt: res.draft.updatedAt };
      } catch {
        try { const d = await getDraft(p.id); if (d.draft?.code?.[lang]) server = { code: d.draft.code[lang]!, updatedAt: d.draft.updatedAt }; } catch { /* offline */ }
      }
      const local = user ? readLocalDraft(user.uid, p.id, lang) : null;
      cur.setCode(lang, resolveInitialCode({ local, server, starter }));
    }
    cur.setLanguage(lang);
    setEditor({ language: lang });
  }, [onBeforeSwitch, setEditor, user]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={!problem} className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-sm text-fg-2 transition-colors hover:bg-ws-hover hover:text-fg-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60 disabled:opacity-50">
          {preparing ? <><Loader2 className="size-3.5 animate-spin" /> Preparing {LABELS[preparing]}…</> : <>{LABELS[language]} <ChevronDown className="size-3.5 text-fg-3" /></>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44 border-line bg-ws-panel text-fg-1">
        {ORDER.map((l) => {
          const info = languages.find((x) => x.key === l);
          const ready = info?.ready ?? false;
          return (
            <DropdownMenuItem key={l} onSelect={() => void switchTo(l)} className={cn("justify-between", l === language && "text-brand-to")}>
              <span>{LABELS[l]}</span>
              <span className="text-xs text-fg-3">{l === language ? <Check className="size-3.5" /> : ready ? "" : "AI"}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
