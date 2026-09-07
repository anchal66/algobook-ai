"use client";
/** Landing sections (Module 05 U-10): hero, trust row, live stats, feature bento, how it works. */
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, CalendarCheck, Code2, GitBranch, Mic2, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroSceneLazy } from "@/components/design/HeroSceneLazy";
import { AnimatedNumber, EASE, Magnetic, Reveal, TiltCard } from "@/components/design/motion";
import { apiFetch } from "@/lib/api-client";
import { useQuery } from "@/lib/app/query";
import { cn } from "@/lib/utils";

const COMPANIES = ["Google", "Amazon", "Meta", "Microsoft", "Apple", "Uber"];

export function Hero() {
  const stats = useQuery("/api/public/stats", () => apiFetch<{ problemsVerified: number; solvesToday: number; usersRanked: number; languages: number }>("/api/public/stats", { anonymous: true }), { staleMs: 60_000 });
  return (
    <section className="relative overflow-hidden">
      <div className="aurora" aria-hidden><i /><i /><i /></div>
      <div className="bg-grid mask-fade-b absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-24">
        <div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3 py-1 text-xs font-medium text-text-2 backdrop-blur">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-70" /><span className="relative inline-flex size-2 rounded-full bg-ok" /></span>
            Every problem verified on the judge before you see it
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.05 }} className="mt-5 text-3xl font-semibold tracking-tight text-text-1 sm:text-display">
            Practice like it&rsquo;s the <span className="text-gradient">real interview.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.12 }} className="mt-5 max-w-xl text-md text-text-2 sm:text-lg">
            AI-generated, judge-verified problems in Java, Python, C++ and JavaScript. A LeetCode-parity editor, an AI tutor that won&rsquo;t spoil the answer, spaced repetition, a rating and a daily challenge — planned around your goal.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.2 }} className="mt-8 flex flex-wrap items-center gap-3">
            <Magnetic><Button asChild variant="brand" size="xl"><Link href="/login">Start free <ArrowRight className="size-4" /></Link></Button></Magnetic>
            <Button asChild variant="outline" size="xl"><a href="#demo">See a problem</a></Button>
            <span className="text-sm text-text-3">No credit card. Google sign-in.</span>
          </motion.div>
          <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.35 }} className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[["Problems verified", stats.data?.problemsVerified ?? 0], ["Solves today", stats.data?.solvesToday ?? 0], ["Languages", stats.data?.languages ?? 4]].map(([k, v]) => (
              <div key={String(k)}><dt className="text-xs text-text-3">{k}</dt><dd className="text-xl font-semibold text-text-1"><AnimatedNumber value={Number(v)} /></dd></div>
            ))}
          </motion.dl>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[520px]">
          <HeroSceneLazy className="absolute inset-0" />
        </div>
      </div>
      <div className="relative border-t border-line/60">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-5 py-6 sm:flex-row sm:px-8">
          <p className="shrink-0 text-xs font-medium uppercase tracking-wider text-text-3">Company lists modelled on</p>
          <ul className="mask-fade-x flex w-full items-center justify-around gap-8 overflow-hidden">
            {COMPANIES.map((c) => <li key={c} className="text-md font-semibold tracking-tight text-text-3/80 sm:text-lg">{c}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export interface Shot { src: string; alt: string }
const FEATURES: { icon: typeof ShieldCheck; title: string; text: string; shot?: string; span?: string }[] = [
  { icon: ShieldCheck, title: "Verified before you see it", text: "A reference solution runs against every hidden test on the judge at generation time. Broken drivers — the #1 complaint about AI problem sets — cannot reach your editor.", shot: "/screens/workspace.webp", span: "lg:col-span-2 lg:row-span-2" },
  { icon: Code2, title: "LeetCode-parity editor", text: "Resizable panels, testcases with named parameters, Beats %, editorial, submissions, notes, timer, Vim/Emacs, ⌘' to run." },
  { icon: Sparkles, title: "Hints, editorial, tutor", text: "Three hint levels, an editorial in every language, error explanations and a scoped tutor chat that refuses to hand over the solution." },
  { icon: BrainCircuit, title: "Mastery + spaced repetition", text: "Topic mastery from accuracy, first-try rate, speed and independence; SM-2 review scheduling brings weak topics back at the right time.", shot: "/screens/profile.webp", span: "lg:col-span-2" },
  { icon: GitBranch, title: "Company templates", text: "Google, Amazon, Meta, Microsoft, Apple and Uber lists, pre-generated and verified in all four languages." },
  { icon: Trophy, title: "Rating & leaderboard", text: "An Elo-style rating per solve, global and weekly boards, and company cohorts." },
  { icon: CalendarCheck, title: "Daily challenge", text: "One verified problem for everyone every day; +20 XP and a streak that survives a missed day with a freeze." },
  { icon: Mic2, title: "Mock interview", text: "45 minutes, two problems around your rating, no hints — then an AI interviewer debriefs you: score, verdict, strengths, gaps." },
];

export function FeatureBento({ shots }: { shots: Record<string, boolean> }) {
  return (
    <section id="product" className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8">
      <Reveal><p className="text-xs font-semibold uppercase tracking-wider text-brand">What you get</p><h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-text-1 sm:text-3xl">More capable than a static problem list — and honest about it.</h2></Reveal>
      <div className="mt-10 grid auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 4) * 0.05} className={cn("group", f.span)}>
            <TiltCard className="h-full" max={4}>
              <div className="glow-card flex h-full flex-col overflow-hidden rounded-card border border-line bg-card">
                <div className="p-5">
                  <span className="flex size-9 items-center justify-center rounded-[8px] bg-brand-soft text-brand"><f.icon className="size-4.5" /></span>
                  <h3 className="mt-3 text-md font-semibold text-text-1">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-text-2">{f.text}</p>
                </div>
                {f.shot && shots[f.shot] && (
                  <div className="relative mt-auto ml-5 flex-1 overflow-hidden rounded-tl-[10px] border-l border-t border-line bg-surface-1" style={{ minHeight: 200 }}>
                    <Image src={f.shot} alt={`${f.title} — product screenshot`} fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover object-left-top transition-transform duration-600 ease-out-quart group-hover:scale-[1.02]" />
                  </div>
                )}
              </div>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Describe your goal", text: "Pick a company template or tell us the role, the date and the topics you dread. AlgoBook AI writes a plan with milestones and a weekly focus.", art: <PlanArt /> },
  { n: "02", title: "Solve verified problems", text: "Each problem is generated for you or reused from the shared pool, executed against hidden tests and only then served — with hints, editorial and a tutor on tap.", art: <VerifyArt /> },
  { n: "03", title: "Track, adapt, repeat", text: "Mastery, spaced repetition and your rating decide what comes next. Streaks, XP, badges and boards keep you coming back.", art: <AdaptArt /> },
];

export function HowItWorks() {
  return (
    <section className="border-y border-line/60 bg-surface-1/60">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8">
        <Reveal><p className="text-xs font-semibold uppercase tracking-wider text-brand">How it works</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-1 sm:text-3xl">Three steps. No busywork.</h2></Reveal>
        <ol className="mt-10 grid gap-6 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08} as="li">
              <div className="flex h-full flex-col rounded-card border border-line bg-card p-6">
                <div className="h-36 overflow-hidden rounded-[10px] bg-surface-1">{s.art}</div>
                <p className="mt-5 font-mono text-xs text-brand">{s.n}</p>
                <h3 className="mt-1 text-lg font-semibold text-text-1">{s.title}</h3>
                <p className="mt-2 text-sm text-text-2">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PlanArt() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-5">
      {["Week 1 · Arrays, Hash map", "Week 2 · Two pointers, Sliding window", "Week 3 · Trees, BFS/DFS"].map((t, i) => (
        <motion.div key={t} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 * i, duration: 0.45, ease: EASE }} className="flex items-center gap-2 rounded-[8px] border border-line bg-card px-3 py-1.5 text-xs text-text-2">
          <span className="size-2 rounded-full bg-brand" />{t}
        </motion.div>
      ))}
    </div>
  );
}
function VerifyArt() {
  const steps = ["Generate", "Reference solution", "14 hidden tests", "Verified ✓"];
  return (
    <div className="flex h-full items-center justify-center gap-1 p-4">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <motion.span initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.18 * i, duration: 0.4, ease: EASE }} className={cn("rounded-full px-2.5 py-1 text-2xs font-medium", i === steps.length - 1 ? "bg-ok text-white" : "border border-line bg-card text-text-2")}>{s}</motion.span>
          {i < steps.length - 1 && <motion.span initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.18 * i + 0.1, duration: 0.3 }} className="h-px w-3 origin-left bg-line-strong" />}
        </div>
      ))}
    </div>
  );
}
function AdaptArt() {
  const bars = [35, 55, 48, 70, 62, 84, 91];
  return (
    <div className="flex h-full items-end justify-center gap-2 p-5">
      {bars.map((h, i) => <motion.div key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ delay: 0.06 * i, duration: 0.5, ease: EASE }} className="w-6 rounded-t-[4px] bg-brand" style={{ opacity: 0.45 + i * 0.08 }} />)}
    </div>
  );
}
