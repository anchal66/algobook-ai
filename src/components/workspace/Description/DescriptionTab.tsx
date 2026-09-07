"use client";
/** Description tab (Module 03 §1.3 / W-05): header, statement, examples, constraints, follow-up, hints, footer. */
import { useState } from "react";
import { useWorkspace } from "@/store/workspace";
import { ProblemHeader } from "@/components/workspace/Description/ProblemHeader";
import { StatementMarkdown, SupText, CODE_CHIP } from "@/components/workspace/Description/StatementMarkdown";
import { ExampleBlock } from "@/components/workspace/Description/ExampleBlock";
import { HintsAccordion } from "@/components/workspace/Description/HintsAccordion";
import { WhyThisProblem } from "@/components/workspace/Description/WhyThisProblem";
import { DescriptionFooter } from "@/components/workspace/Description/DescriptionFooter";
import { GenerationStages } from "@/components/workspace/Drawer/GenerationStages";

export function DescriptionSkeleton() {
  return (
    <div className="space-y-4 p-5" aria-busy="true" aria-label="Loading problem">
      <div className="ws-shimmer h-7 w-48 rounded" />
      <div className="flex gap-2">{[48, 64, 72].map((w) => <div key={w} className="ws-shimmer h-6 rounded-full" style={{ width: w }} />)}</div>
      {[95, 80, 88, 60].map((w, i) => <div key={i} className="ws-shimmer h-3.5 rounded" style={{ width: `${w}%` }} />)}
      <div className="ws-shimmer h-20 rounded-[6px]" />
      <div className="ws-shimmer h-20 rounded-[6px]" />
    </div>
  );
}

export function DescriptionTab() {
  const problem = useWorkspace((s) => s.problem);
  const loading = useWorkspace((s) => s.loading);
  const error = useWorkspace((s) => s.error);
  const generation = useWorkspace((s) => s.generation);
  const [showTopics, setShowTopics] = useState(false);
  const [showCompanies, setShowCompanies] = useState(false);
  const [showHints, setShowHints] = useState(false);

  if (generation.active || (generation.error && !problem)) return <GenerationStages />;
  if (loading) return <DescriptionSkeleton />;
  if (error || !problem) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-fg-1">Problem unavailable</p>
        <p className="max-w-sm text-sm text-fg-3">{error ?? "Nothing to show yet."}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="ws-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <WhyThisProblem />
        <ProblemHeader
          problem={problem}
          showTopics={showTopics} showCompanies={showCompanies} showHints={showHints}
          onToggleTopics={() => setShowTopics((v) => !v)} onToggleCompanies={() => setShowCompanies((v) => !v)} onToggleHints={() => setShowHints((v) => !v)}
        />
        <StatementMarkdown markdown={problem.statementMd} />
        <div className="mt-6">
          {problem.examples.map((ex, i) => <ExampleBlock key={i} index={i + 1} example={ex} params={problem.params} />)}
        </div>
        {problem.constraints.length > 0 && (
          <section className="my-5" aria-label="Constraints">
            <p className="mb-2 text-sm font-semibold text-fg-1">Constraints:</p>
            <ul className="list-disc space-y-1.5 pl-6 text-sm">
              {problem.constraints.map((c, i) => <li key={i}><code className={CODE_CHIP}><SupText text={c} /></code></li>)}
            </ul>
          </section>
        )}
        {problem.followUp && (
          <section className="my-5 text-sm" aria-label="Follow-up">
            <div className="[&_p]:inline"><strong className="font-semibold text-fg-1">Follow-up: </strong><StatementMarkdown markdown={problem.followUp} className="inline" /></div>
          </section>
        )}
        {(showHints || problem.hintsPreview > 0) && showHints && <HintsAccordion />}
        <div className="h-4" />
      </div>
      <DescriptionFooter problem={problem} />
    </div>
  );
}
