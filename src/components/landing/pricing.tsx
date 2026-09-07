"use client";
/** Landing: comparison table, pricing and FAQ (Module 05 U-10 §2.1 items 5–7). */
import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/design/motion";
import { cn } from "@/lib/utils";
import { FAQ } from "@/components/landing/faq";

const COMPARE: { feature: string; algobook: string | boolean; leetcode: string | boolean }[] = [
  { feature: "Personalised problem generation around your goal", algobook: true, leetcode: false },
  { feature: "Every problem executed against hidden tests before it is served", algobook: true, leetcode: "Curated by staff" },
  { feature: "AI tutor that explains errors and hints without spoiling", algobook: true, leetcode: "Limited" },
  { feature: "Editorial for every problem in 4 languages", algobook: true, leetcode: "Premium, selected problems" },
  { feature: "Spaced repetition & topic mastery", algobook: true, leetcode: false },
  { feature: "Rating per solve, weekly boards, company cohorts", algobook: true, leetcode: "Contests only" },
  { feature: "Mock interview with AI debrief", algobook: "Pro", leetcode: "Premium, separate" },
  { feature: "Price", algobook: "Free · Pro ₹499/mo", leetcode: "Premium ≈ ₹2,900/mo" },
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <span className="inline-flex size-6 items-center justify-center rounded-full bg-ok/15 text-ok"><Check className="size-3.5" strokeWidth={3} /></span>;
  if (v === false) return <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-3 text-text-3"><X className="size-3.5" /></span>;
  return <span className="text-sm text-text-2">{v}</span>;
}

export function Compare() {
  return (
    <section id="compare" className="mx-auto max-w-[1000px] px-5 py-20 sm:px-8">
      <Reveal><p className="text-xs font-semibold uppercase tracking-wider text-brand">Compared</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-1 sm:text-3xl">AlgoBook vs LeetCode</h2><p className="mt-2 max-w-2xl text-base text-text-2">LeetCode is the benchmark — our editor deliberately matches it. Where we differ is everything around the problem.</p></Reveal>
      <Reveal className="mt-8 overflow-x-auto rounded-card border border-line bg-card" tabIndex={0} aria-label="Comparison table">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-text-3"><th className="px-5 py-3 font-medium">Feature</th><th className="px-5 py-3 font-semibold text-brand">AlgoBook</th><th className="px-5 py-3 font-medium">LeetCode</th></tr></thead>
          <tbody>{COMPARE.map((r) => <tr key={r.feature} className="border-b border-line/70 last:border-0"><td className="px-5 py-3 text-text-1">{r.feature}</td><td className="px-5 py-3"><Cell v={r.algobook} /></td><td className="px-5 py-3"><Cell v={r.leetcode} /></td></tr>)}</tbody>
        </table>
      </Reveal>
      <p className="mt-2 text-xs text-text-3">LeetCode pricing and features as publicly listed on 2026-09-07; verify current terms on their site.</p>
    </section>
  );
}

const MATRIX: { label: string; free: string; pro: string }[] = [
  { label: "AI-generated problems / day", free: "3", pro: "200" },
  { label: "Verified pool problems", free: "Unlimited", pro: "Unlimited" },
  { label: "Runs / day", free: "30", pro: "2,000" },
  { label: "Languages (Java · Python · C++ · JS)", free: "All 4", pro: "All 4" },
  { label: "Hints", free: "Levels 1–2", pro: "Levels 1–3 (reads your code)" },
  { label: "Editorials", free: "—", pro: "Unlimited" },
  { label: "AI tutor chat", free: "—", pro: "300 msgs / day" },
  { label: "Inline AI completion", free: "—", pro: "3,000 / day" },
  { label: "Post-solve code review", free: "—", pro: "200 / day" },
  { label: "Mock interviews", free: "—", pro: "5 / day" },
  { label: "Daily challenge, streaks, leaderboard", free: "Included", pro: "Included" },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-y border-line/60 bg-surface-1/60">
      <div className="mx-auto max-w-[1100px] px-5 py-20 sm:px-8">
        <Reveal className="text-center"><p className="text-xs font-semibold uppercase tracking-wider text-brand">Pricing</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-1 sm:text-3xl">Simple, transparent pricing</h2><p className="mt-2 text-base text-text-2">Full access. No auto-deduction. Renew only when you want to.</p></Reveal>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {[
            { name: "Free", price: "₹0", per: "forever", cta: "Start free", href: "/login", variant: "outline" as const, blurb: "Daily practice from the verified pool with a taste of generation." },
            { name: "Pro Monthly", price: "₹499", per: "/ 30 days", cta: "Go Pro", href: "/login?next=/settings%23plan", variant: "brand" as const, blurb: "Everything unlocked. Ideal for a focused interview sprint.", featured: true },
            { name: "Pro Yearly", price: "₹4,999", per: "/ year", cta: "Go Pro yearly", href: "/login?next=/settings%23plan", variant: "outline" as const, blurb: "Save 17% — a full year of uninterrupted access.", badge: "Save 17%" },
          ].map((p, i) => (
            <Reveal key={p.name} delay={i * 0.06}>
              <div className={cn("relative flex h-full flex-col rounded-card border bg-card p-6", p.featured ? "border-brand shadow-[0_0_0_1px_var(--brand),0_24px_60px_-30px_rgba(99,102,241,0.6)]" : "border-line")}>
                {p.badge && <Badge variant="gradient" className="absolute -top-3 right-5">{p.badge}</Badge>}
                {p.featured && <Badge variant="brand" className="absolute -top-3 left-5">Most popular</Badge>}
                <h3 className="text-md font-semibold text-text-1">{p.name}</h3>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-text-1">{p.price}<span className="ml-1 text-sm font-normal text-text-3">{p.per}</span></p>
                <p className="mt-2 text-sm text-text-2">{p.blurb}</p>
                <Button asChild variant={p.variant} size="lg" className="mt-6"><Link href={p.href}>{p.cta}</Link></Button>
                <p className="mt-3 text-center text-xs text-text-3">{p.name === "Free" ? "No credit card" : "No auto-renewal · renew manually"}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-8 overflow-x-auto rounded-card border border-line bg-card" tabIndex={0} aria-label="Daily limits table">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-text-3"><th className="px-5 py-3 text-left font-medium">Daily limits</th><th className="px-5 py-3 text-left font-medium">Free</th><th className="px-5 py-3 text-left font-semibold text-brand">Pro</th></tr></thead>
            <tbody>{MATRIX.map((r) => <tr key={r.label} className="border-b border-line/70 last:border-0"><td className="px-5 py-2.5 text-text-1">{r.label}</td><td className="px-5 py-2.5 text-text-2">{r.free === "—" ? <Minus className="size-4 text-text-3" /> : r.free}</td><td className="px-5 py-2.5 text-text-1">{r.pro}</td></tr>)}</tbody>
          </table>
        </Reveal>
      </div>
    </section>
  );
}


export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[800px] px-5 py-20 sm:px-8">
      <Reveal><p className="text-xs font-semibold uppercase tracking-wider text-brand">FAQ</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-1 sm:text-3xl">Questions, answered</h2></Reveal>
      <Reveal className="mt-8">
        <Accordion type="single" collapsible className="divide-y divide-line rounded-card border border-line bg-card px-5">
          {FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={`q${i}`} className="border-0">
              <AccordionTrigger className="py-4 text-left text-md font-medium text-text-1 hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="pb-4 text-base text-text-2">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
      <Reveal className="mt-14 rounded-card border border-line bg-card p-8 text-center">
        <h3 className="text-xl font-semibold tracking-tight text-text-1">Ready when you are.</h3>
        <p className="mt-2 text-base text-text-2">Your first project takes two minutes. Your first accepted solution, maybe five.</p>
        <Button asChild variant="brand" size="xl" className="mt-6"><Link href="/login">Start free</Link></Button>
      </Reveal>
    </section>
  );
}

