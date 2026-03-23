"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Sparkles,
  Code2,
  BarChart3,
  BrainCircuit,
  Target,
  TrendingUp,
  ArrowRight,
  Check,
  Zap,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">AlgoBook</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="gap-1.5">
                Get Started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 bg-grid">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-primary/8 blur-[100px]" />
        </div>
        <motion.div
          className="relative mx-auto max-w-4xl text-center px-6"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Interview Prep
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Master Algorithms with{" "}
            <span className="text-gradient">AI-Powered</span>{" "}
            Practice
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Describe what you want to practice in plain English. AlgoBook generates
            LeetCode-style challenges, lets you code in a real editor, and tracks
            your progress — all powered by GPT-4.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="text-base px-8 py-6 gap-2 shadow-lg shadow-primary/25">
                Start Practicing Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="text-base px-8 py-6">
                See How It Works
              </Button>
            </a>
          </motion.div>
          <motion.p variants={fadeUp} className="mt-4 text-xs text-muted-foreground">
            No credit card required. Sign in with Google to get started.
          </motion.p>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 md:py-32 border-t border-border/50">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.p variants={fadeUp} className="text-sm font-medium text-primary mb-2">Features</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight">
              Everything you need to ace your interviews
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
              A complete practice environment — from AI question generation to code execution and progress tracking.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            {[
              {
                icon: BrainCircuit,
                title: "AI Question Generation",
                desc: "Describe a topic in plain English and GPT-4 generates a complete problem with examples, constraints, test cases, and starter code.",
              },
              {
                icon: Code2,
                title: "In-Browser Java Editor",
                desc: "Write, format, and run Java code in a Monaco-powered editor with syntax highlighting, auto-completion, and real-time feedback.",
              },
              {
                icon: BarChart3,
                title: "Smart Progress Tracking",
                desc: "Track every submission per project and question. See your success rate, review past attempts, and measure your improvement.",
              },
            ].map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                className="group relative rounded-2xl border border-border/60 bg-card p-8 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-5 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 md:py-32 bg-muted/30 border-t border-border/50">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.p variants={fadeUp} className="text-sm font-medium text-primary mb-2">How It Works</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight">
              Three steps to interview-ready
            </motion.h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            {[
              {
                step: "01",
                icon: Target,
                title: "Describe Your Goal",
                desc: "Create a project like \"Mastering Graph Algorithms\" and tell the AI exactly what you want to practice.",
              },
              {
                step: "02",
                icon: Zap,
                title: "Solve AI Problems",
                desc: "Get unique coding challenges generated on demand. Write your solution in Java and run it against test cases.",
              },
              {
                step: "03",
                icon: TrendingUp,
                title: "Track & Improve",
                desc: "Review your submission history, see what passed and failed, and generate harder problems as you progress.",
              },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeUp} className="text-center">
                <div className="mx-auto mb-6 inline-flex items-center justify-center rounded-2xl border-2 border-primary/20 bg-primary/5 p-5">
                  <item.icon className="h-8 w-8 text-primary" />
                </div>
                <p className="text-xs font-bold text-primary tracking-widest mb-2">STEP {item.step}</p>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 md:py-32 border-t border-border/50">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.p variants={fadeUp} className="text-sm font-medium text-primary mb-2">Pricing</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight">
              Simple, transparent pricing
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-muted-foreground text-lg">
              Full access. No auto-deduction. Renew only when you want to.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            {/* Free tier */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-border/60 bg-card p-8 flex flex-col">
              <p className="text-sm font-medium text-muted-foreground mb-1">Free</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">&#8377;0</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {[
                  "Sign in & view dashboard",
                  "Browse existing projects",
                  "View submission history",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login">
                <Button variant="outline" className="w-full">Get Started</Button>
              </Link>
            </motion.div>

            {/* Pro Monthly */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-border/60 bg-card p-8 flex flex-col">
              <p className="text-sm font-medium text-primary mb-1">Pro Monthly</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold">&#8377;499</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <p className="text-xs text-muted-foreground mb-6">No auto-renewal &middot; renew manually</p>
              <ul className="space-y-3 mb-8 flex-grow">
                {[
                  "Unlimited AI question generation",
                  "Full code editor & execution",
                  "Unlimited projects",
                  "Smart AI hints & recommendations",
                  "Performance tracking & mastery",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Get Started <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </motion.div>

            {/* Pro Yearly */}
            <motion.div variants={fadeUp} className="relative rounded-2xl border-2 border-primary bg-card p-8 flex flex-col shadow-xl shadow-primary/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                Save 17%
              </div>
              <p className="text-sm font-medium text-primary mb-1">Pro Yearly</p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold">&#8377;4,999</span>
                <span className="text-muted-foreground text-sm">/year</span>
              </div>
              <p className="text-xs text-muted-foreground mb-6">No auto-renewal &middot; renew manually</p>
              <ul className="space-y-3 mb-8 flex-grow">
                {[
                  "Everything in Pro Monthly",
                  "Save 17% vs paying monthly",
                  "Full year of uninterrupted access",
                  "Performance tracking & mastery",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login">
                <Button className="w-full shadow-lg shadow-primary/20">
                  Get Started <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Code2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">AlgoBook</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} AlgoBook. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
