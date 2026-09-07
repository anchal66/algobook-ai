"use client";
/** `1. Two Sum` + pill row: difficulty, Topics, Companies, Hint (Module 03 §1.3). */
import { Building2, Lightbulb, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProblemDTO } from "@/lib/workspace/types";

export const DIFFICULTY_TEXT: Record<ProblemDTO["difficulty"], string> = { Easy: "text-easy", Medium: "text-medium", Hard: "text-hard" };

export interface ProblemHeaderProps {
  problem: ProblemDTO;
  showTopics: boolean;
  showCompanies: boolean;
  showHints: boolean;
  onToggleTopics: () => void;
  onToggleCompanies: () => void;
  onToggleHints: () => void;
}

const pill = (active: boolean) => cn(
  "flex h-6 items-center gap-1 rounded-full bg-ws-chip px-2.5 text-xs text-fg-2 transition-colors duration-150 hover:bg-ws-hover hover:text-fg-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60",
  active && "text-fg-1",
);

export function ProblemHeader({ problem, showTopics, showCompanies, showHints, onToggleTopics, onToggleCompanies, onToggleHints }: ProblemHeaderProps) {
  const title = problem.number ? `${problem.number}. ${problem.title}` : problem.title;
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-semibold leading-7 text-fg-1">{title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={cn("flex h-6 items-center rounded-full bg-ws-chip px-2.5 text-xs", DIFFICULTY_TEXT[problem.difficulty])}>{problem.difficulty}</span>
        <button type="button" onClick={onToggleTopics} aria-expanded={showTopics} className={pill(showTopics)}>
          <Tag className="size-3.5" /> Topics
        </button>
        {problem.companies.length > 0 && (
          <button type="button" onClick={onToggleCompanies} aria-expanded={showCompanies} className={pill(showCompanies)}>
            <Building2 className="size-3.5" /> Companies
          </button>
        )}
        {problem.hintsPreview > 0 && (
          <button type="button" onClick={onToggleHints} aria-expanded={showHints} className={pill(showHints)}>
            <Lightbulb className="size-3.5" /> Hint
          </button>
        )}
      </div>
      {showTopics && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">
          {problem.tags.length ? problem.tags.map((t) => <span key={t} className="rounded-full bg-ws-chip px-2.5 py-0.5 text-xs capitalize text-fg-1">{t}</span>) : <span className="text-xs text-fg-3">No topics tagged</span>}
        </div>
      )}
      {showCompanies && problem.companies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Companies">
          {problem.companies.map((c) => <span key={c} className="rounded-full bg-[#ffa116]/15 px-2.5 py-0.5 text-xs capitalize text-[#ffa116]">{c}</span>)}
        </div>
      )}
    </header>
  );
}
