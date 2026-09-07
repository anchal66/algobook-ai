"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Hero, FeatureBento, HowItWorks } from "@/components/landing/sections";
import { Compare, Pricing, Faq } from "@/components/landing/pricing";
import { DemoWorkspace } from "@/components/landing/DemoWorkspace";
import { Reveal } from "@/components/design/motion";
import { Suspense } from "react";

function Redirector() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  // Signed-in visitors go straight to the app unless they explicitly asked for the home page (?home=1 / nav link).
  useEffect(() => { if (!loading && user && sp.get("home") !== "1") router.replace("/dashboard"); }, [loading, user, router, sp]);
  return null;
}

export function LandingClient({ shots }: { shots: Record<string, boolean> }) {
  return (
    <>
      <Suspense fallback={null}><Redirector /></Suspense>
      <Hero />
      <section id="demo" className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8">
        <Reveal><p className="text-xs font-semibold uppercase tracking-wider text-brand">Live demo</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-1 sm:text-3xl">This is the actual workspace. Run something.</h2><p className="mt-2 max-w-2xl text-base text-text-2">Edit the code and press Run — it executes against the sample tests right here, no account needed. Sign in for hidden tests, Java/Python/C++, Beats % and the tutor.</p></Reveal>
        <Reveal className="mt-8" y={24}><DemoWorkspace /></Reveal>
      </section>
      <FeatureBento shots={shots} />
      <HowItWorks />
      <Compare />
      <Pricing />
      <Faq />
    </>
  );
}
