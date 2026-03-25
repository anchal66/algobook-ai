import type { Metadata } from "next";
import Link from "next/link";
import { Code2, ArrowLeft, BrainCircuit, Target, Zap, Heart } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about AlgoBook — the AI-powered coding practice platform by CognitiveSquad.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-20">
          <div className="mx-auto mb-6 inline-flex items-center justify-center rounded-2xl bg-primary/10 p-5">
            <Code2 className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">About AlgoBook</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            AlgoBook is an AI-powered coding practice platform built to help developers sharpen their
            problem-solving skills and prepare for technical interviews — smarter, not harder.
          </p>
        </div>

        {/* Mission */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-6">Our Mission</h2>
          <div className="rounded-2xl border border-border/60 bg-card p-8">
            <p className="text-muted-foreground leading-relaxed text-base">
              We believe that coding interview preparation should be personalized, intelligent, and accessible.
              Traditional platforms give you a static list of problems. AlgoBook goes further — it understands your
              strengths and weaknesses, adapts to your skill level, and generates fresh challenges using AI.
              Our goal is to make every developer interview-ready through smart, adaptive practice.
            </p>
          </div>
        </section>

        {/* What Makes Us Different */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-8">What Makes AlgoBook Different</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: BrainCircuit,
                title: "AI-Powered Questions",
                desc: "GPT-4 generates unique, LeetCode-style problems tailored to your skill level and goals. No two practice sessions are the same.",
              },
              {
                icon: Target,
                title: "Adaptive Difficulty",
                desc: "AlgoBook tracks your performance across topics and automatically adjusts difficulty. Struggling with graphs? You'll get more practice. Mastered arrays? Time for harder challenges.",
              },
              {
                icon: Zap,
                title: "Real Code Execution",
                desc: "Write Java code in a Monaco-powered editor with syntax highlighting and run it against test cases. Get instant feedback on correctness and performance.",
              },
              {
                icon: Heart,
                title: "Built for Consistency",
                desc: "Daily attendance tracking, streak counters, and mastery scores help you build the habit of regular practice. Your profile tracks every step of your progress.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Built By */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-6">Built by CognitiveSquad</h2>
          <div className="rounded-2xl border border-border/60 bg-card p-8">
            <p className="text-muted-foreground leading-relaxed text-base mb-4">
              AlgoBook is a product of <strong className="text-foreground">CognitiveSquad</strong>, a team passionate about
              combining artificial intelligence with education technology. We build tools that make learning
              more effective and accessible for developers around the world.
            </p>
            <p className="text-muted-foreground leading-relaxed text-base">
              Have ideas or want to collaborate? We&apos;d love to hear from you at{" "}
              <a href="mailto:contact@cognitivesquad.com" className="text-primary hover:underline">
                contact@cognitivesquad.com
              </a>.
            </p>
          </div>
        </section>

        {/* Tech Stack */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Our Tech Stack</h2>
          <div className="flex flex-wrap gap-2">
            {[
              "Next.js", "React", "TypeScript", "Firebase", "Firestore",
              "GPT-4 (OpenAI)", "Monaco Editor", "Tailwind CSS", "Radix UI",
              "Framer Motion", "Vercel",
            ].map((tech) => (
              <span
                key={tech}
                className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
