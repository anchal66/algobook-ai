"use client";

import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Code2, ArrowLeft, Loader2, Moon, Sun, Monitor,
  Crown, Sparkles, CreditCard, User, Shield,
} from "lucide-react";
import { useTheme } from "next-themes";
import UserMenu from "@/components/UserMenu";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { active: hasSubscription, loading: subLoading, plan, currentPeriodEnd, redirectToCheckout } = useSubscription();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-10">Settings</h1>

        {/* Account Section */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Account
          </h2>
          <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-muted-foreground">{user.displayName || "Not set"}</p>
              </div>
            </div>
            <div className="border-t border-border/40" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="border-t border-border/40" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Profile</p>
                <p className="text-sm text-muted-foreground">View and edit your public profile</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push("/profile")}>
                Edit Profile
              </Button>
            </div>
          </div>
        </section>

        {/* Subscription Section */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Subscription
          </h2>
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            {subLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : hasSubscription ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{plan?.name || "Pro"} Plan</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                {currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    Valid until: {new Date(currentPeriodEnd).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  No auto-renewal. You can renew your plan when it expires.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You&apos;re currently on the <strong className="text-foreground">Free</strong> plan. Upgrade to Pro to unlock all features.
                </p>
                <div className="flex items-center gap-3">
                  <Button onClick={() => redirectToCheckout("pro-monthly")} variant="outline" className="gap-1.5" size="sm">
                    <Sparkles className="h-3.5 w-3.5" /> ₹499/mo
                  </Button>
                  <Button onClick={() => redirectToCheckout("pro-yearly")} className="gap-1.5 shadow-lg shadow-primary/20" size="sm">
                    <Sparkles className="h-3.5 w-3.5" /> ₹4,999/yr &middot; Save 17%
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Theme Section */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sun className="h-5 w-5 text-primary" /> Appearance
          </h2>
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <p className="text-sm text-muted-foreground mb-4">Choose your preferred theme</p>
            <div className="flex gap-3">
              {[
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    theme === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Legal
          </h2>
          <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-3">
            <Link href="/privacy" className="flex items-center justify-between hover:text-primary transition-colors">
              <span className="text-sm">Privacy Policy</span>
              <span className="text-xs text-muted-foreground">&rarr;</span>
            </Link>
            <div className="border-t border-border/40" />
            <Link href="/terms" className="flex items-center justify-between hover:text-primary transition-colors">
              <span className="text-sm">Terms of Service</span>
              <span className="text-xs text-muted-foreground">&rarr;</span>
            </Link>
            <div className="border-t border-border/40" />
            <Link href="/contact" className="flex items-center justify-between hover:text-primary transition-colors">
              <span className="text-sm">Contact Us</span>
              <span className="text-xs text-muted-foreground">&rarr;</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
