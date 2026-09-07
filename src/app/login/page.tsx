"use client";
/** Login (Module 05 U-11): split layout — compact hero scene + value props · Google sign-in with `next` redirect and popup-blocked fallback. */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getRedirectResult, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { CheckCircle2, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/design/Logo";
import { HeroSceneLazy } from "@/components/design/HeroSceneLazy";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/design/motion";

const PROPS = [
  { icon: ShieldCheck, title: "Every problem is verified before you see it", text: "A reference solution runs against every hidden test on the judge — broken drivers never reach your editor." },
  { icon: Sparkles, title: "An AI tutor that won't spoil the answer", text: "Hints in three levels, error explanations, editorials in four languages and a scoped chat that keeps you thinking." },
  { icon: Timer, title: "Practice that adapts to you", text: "Mastery, spaced repetition, a rating and a daily challenge decide what you should solve next." },
];

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!loading && user) router.replace(next); }, [loading, user, next, router]);
  useEffect(() => {
    // Completes the redirect flow used when popups are blocked.
    getRedirectResult(auth).catch((e: { code?: string; message?: string }) => setError(friendly(e)));
  }, []);

  const signIn = async () => {
    setBusy(true); setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        try { await signInWithRedirect(auth, googleProvider); return; } catch (e2) { setError(friendly(e2 as { code?: string })); }
      } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(friendly(e as { code?: string }));
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Left: brand panel */}
      <aside className="relative hidden overflow-hidden bg-surface-0 lg:flex lg:flex-col dark:bg-[#0b0b0d]">
        <div className="aurora" aria-hidden><i /><i /><i /></div>
        <div className="relative z-10 flex h-full flex-col p-10">
          <Link href="/" aria-label="AlgoBook home"><Logo size={30} /></Link>
          <div className="relative mt-6 flex-1">
            <HeroSceneLazy compact className="absolute inset-0 mx-auto max-h-[440px] max-w-[440px]" />
          </div>
          <ul className="relative z-10 grid gap-4">
            {PROPS.map((p, i) => (
              <Reveal key={p.title} delay={0.1 + i * 0.08}>
                <li className="glass flex gap-3 rounded-card p-4">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-brand-soft text-brand"><p.icon className="size-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-text-1">{p.title}</p>
                    <p className="mt-0.5 text-sm text-text-2">{p.text}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </aside>

      {/* Right: form */}
      <main className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-flex lg:hidden" aria-label="AlgoBook home"><Logo size={30} /></Link>
          <Reveal>
            <h1 className="text-2xl font-semibold tracking-tight text-text-1">Welcome back</h1>
            <p className="mt-2 text-base text-text-2">Sign in to continue your practice. New here? The same button creates your account — no credit card, free tier included.</p>
          </Reveal>
          <Reveal delay={0.08} className="mt-8">
            <Button onClick={() => void signIn()} loading={busy || (loading && !user)} size="xl" variant="default" className="w-full gap-3 border border-line bg-card text-text-1 hover:bg-surface-2 dark:bg-surface-2 dark:hover:bg-surface-3">
              <GoogleMark /> Continue with Google
            </Button>
            {error && <p role="alert" className="mt-3 rounded-[8px] border border-err/30 bg-err/10 px-3 py-2 text-sm text-err">{error}</p>}
          </Reveal>
          <Reveal delay={0.16} className="mt-8 space-y-2">
            {["Free: 3 AI generations a day, unlimited pool problems, 30 runs", "Java, Python 3, C++ and JavaScript", "Your progress, streaks and rating sync across devices"].map((t) => (
              <p key={t} className="flex items-center gap-2 text-sm text-text-2"><CheckCircle2 className="size-4 text-ok" />{t}</p>
            ))}
          </Reveal>
          <p className="mt-10 text-xs text-text-3">
            By continuing you agree to our <Link href="/terms" className="underline underline-offset-2 hover:text-text-1">Terms</Link> and <Link href="/privacy" className="underline underline-offset-2 hover:text-text-1">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

function friendly(e: { code?: string; message?: string }): string {
  switch (e.code) {
    case "auth/network-request-failed": return "Network error — check your connection and try again.";
    case "auth/unauthorized-domain": return "This domain isn't authorised for sign-in yet.";
    case "auth/account-exists-with-different-credential": return "An account already exists with this email using a different provider.";
    default: return e.message?.replace(/^Firebase: /, "").replace(/ \(auth\/.*\)\.?$/, "") || "Sign-in failed. Please try again.";
  }
}

function GoogleMark() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginInner /></Suspense>;
}
