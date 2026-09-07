import type { Metadata } from "next";
import Link from "next/link";
import { BrainCircuit, Flame, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/design/motion";

export const metadata: Metadata = { title: "About", description: "About AlgoBook — the AI-verified coding practice platform by CognitiveSquad." };

const PILLARS = [
  { icon: ShieldCheck, title: "Verified before you see it", text: "Every generated problem ships with a reference solution that is executed against every hidden test before it is saved. A broken driver never reaches your editor." },
  { icon: BrainCircuit, title: "Fresh, personalised problems", text: "AlgoBook AI generates LeetCode-style problems around your goal, your weak topics and your rating band — and reuses verified problems from the shared pool when one fits." },
  { icon: Target, title: "Adaptive by design", text: "Topic mastery, spaced repetition, a practice-state machine and an Elo-style rating decide what you solve next. Struggling with graphs? You get graphs. Mastered arrays? Time to move on." },
  { icon: Flame, title: "Built for consistency", text: "Streaks with freezes, XP and levels, achievements, a daily challenge and leaderboards make daily practice a habit. Your profile tracks every step." },
];

const STACK = ["Next.js", "React", "TypeScript", "Tailwind CSS", "Firebase", "Firestore", "AlgoBook AI", "Monaco Editor", "Judge0", "Radix UI", "Framer Motion", "Three.js", "Vercel"];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">About</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-1 sm:text-display sm:text-[3.25rem]">Interview practice that is trustworthy, adaptive and more capable than a static problem list.</h1>
        <p className="mt-5 max-w-2xl text-md text-text-2">AlgoBook is an AI-powered coding practice platform built to help developers sharpen their problem-solving skills and prepare for technical interviews — smarter, not harder.</p>
      </Reveal>

      <Reveal className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-text-1">Our mission</h2>
        <p className="mt-3 text-base text-text-2">We believe coding-interview preparation should be personalised, intelligent and accessible. Traditional platforms give you a static list of problems. AlgoBook goes further — it understands your strengths and weaknesses, adapts to your level and generates fresh, verified challenges. Our goal is to make every developer interview-ready through smart, adaptive practice.</p>
      </Reveal>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-text-1">What makes AlgoBook different</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <div className="glow-card h-full rounded-card border border-line bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-[8px] bg-brand-soft text-brand"><p.icon className="size-4.5" /></span>
                <h3 className="mt-4 text-md font-semibold text-text-1">{p.title}</h3>
                <p className="mt-1.5 text-sm text-text-2">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-text-1">Built by CognitiveSquad</h2>
        <p className="mt-3 text-base text-text-2">AlgoBook is a product of CognitiveSquad, a team passionate about combining artificial intelligence with education technology. We build tools that make learning more effective and accessible for developers around the world.</p>
        <p className="mt-3 text-base text-text-2">Have ideas or want to collaborate? We&rsquo;d love to hear from you at <a href="mailto:contact@cognitivesquad.com" className="text-brand underline underline-offset-2">contact@cognitivesquad.com</a>.</p>
      </Reveal>

      <Reveal className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-text-1">Our stack</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {STACK.map((t) => <li key={t} className="rounded-chip border border-line bg-surface-1 px-2.5 py-1 text-sm text-text-2">{t}</li>)}
        </ul>
      </Reveal>

      <Reveal className="mt-16 rounded-card border border-line bg-surface-1 p-8 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-text-1">Ready to practice like it&rsquo;s the real interview?</h2>
        <p className="mt-2 text-base text-text-2">Free to start. No credit card.</p>
        <div className="mt-5 flex justify-center gap-3">
          <Button asChild variant="brand" size="lg"><Link href="/login">Start free</Link></Button>
          <Button asChild variant="outline" size="lg"><Link href="/#demo">Try the demo</Link></Button>
        </div>
      </Reveal>
    </div>
  );
}
