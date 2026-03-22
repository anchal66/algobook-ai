"use client";

import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/button";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Code2, ArrowLeft, Sparkles, Shield, Zap } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google: ", error);
    }
  };

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-lg bg-primary animate-pulse" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex min-h-screen">
      {/* Left — Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/80">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-white/10 blur-[100px]" />
        <div className="absolute -top-32 -right-32 h-[300px] w-[300px] rounded-full bg-white/10 blur-[80px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
              <Code2 className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">AlgoBook</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-4xl font-bold leading-tight mb-4">
              Your AI-powered
              <br />
              coding practice partner.
            </h2>
            <p className="text-primary-foreground/80 text-lg leading-relaxed max-w-md">
              Join engineers who use AlgoBook to prepare for technical interviews
              with personalized, AI-generated coding challenges.
            </p>

            <div className="mt-10 space-y-4">
              {[
                { icon: Sparkles, text: "GPT-4 generated problems tailored to you" },
                { icon: Zap, text: "Run & test Java code in the browser" },
                { icon: Shield, text: "Track progress across projects" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/15 p-2">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm text-primary-foreground/90">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <p className="text-sm text-primary-foreground/50">
            &copy; {new Date().getFullYear()} AlgoBook. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right — Sign In */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>

          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">AlgoBook</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
          <p className="text-muted-foreground mb-8">
            Sign in to continue your coding practice.
          </p>

          <Button
            onClick={handleSignIn}
            variant="outline"
            className="w-full justify-center gap-3 py-6 text-base border-border hover:bg-accent transition-all"
          >
            <FcGoogle className="h-5 w-5" />
            Continue with Google
          </Button>

          <p className="mt-8 text-center text-xs text-muted-foreground leading-relaxed">
            By continuing, you agree to our{" "}
            <a href="#" className="underline underline-offset-2 hover:text-foreground">Terms of Service</a>
            {" "}and{" "}
            <a href="#" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</a>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
