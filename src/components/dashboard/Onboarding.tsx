"use client";
/** 3-step onboarding checklist for new users (Module 05 U-12). */
import Link from "next/link";
import { Check, Circle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OnboardingState { hasProject: boolean; hasSolve: boolean; hasProfile: boolean }

export function Onboarding({ state, firstName, firstProjectId }: { state: OnboardingState; firstName: string; firstProjectId?: string | null }) {
  const steps = [
    { done: state.hasProject, title: "Create your first project", text: "Pick a company template or describe your goal — we plan the problem list.", href: "/projects/new", cta: "New project" },
    { done: state.hasSolve, title: "Solve your first problem", text: "Run against sample tests, submit, and unlock your rating.", href: state.hasProject && firstProjectId ? `/project/${firstProjectId}/solve/next` : "/explore", cta: state.hasProject && firstProjectId ? "Solve your first problem" : "Explore" },
    { done: state.hasProfile, title: "Set up your profile", text: "Add a bio and skills so your public profile is share-ready.", href: "/profile/edit", cta: "Edit profile" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <Card className="relative overflow-hidden p-6">
      <div className="aurora opacity-60" aria-hidden><i /><i /><i /></div>
      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand"><Sparkles className="size-3.5" /> Welcome, {firstName}</div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-1">Three steps to your first accepted solution</h2>
        <p className="mt-1 text-sm text-text-2">{doneCount}/3 done. Everything here is free.</p>
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className={cn("glass flex flex-col rounded-card p-4", s.done && "opacity-70")}>
              <div className="flex items-center gap-2">
                <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", s.done ? "bg-ok text-white" : "bg-surface-3 text-text-1")}>{s.done ? <Check className="size-3.5" /> : i + 1}</span>
                <span className="text-sm font-semibold text-text-1">{s.title}</span>
              </div>
              <p className="mt-2 flex-1 text-sm text-text-2">{s.text}</p>
              {!s.done && <Button asChild size="sm" variant={i === doneCount ? "brand" : "outline"} className="mt-3 w-fit"><Link href={s.href}>{s.cta}</Link></Button>}
              {s.done && <span className="mt-3 flex items-center gap-1 text-xs text-ok"><Circle className="size-2 fill-current" /> Done</span>}
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
