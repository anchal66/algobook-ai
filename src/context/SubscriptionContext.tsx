"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

interface SubscriptionPlan {
  name: string;
  slug: string;
}

interface SubscriptionState {
  active: boolean;
  loading: boolean;
  plan: SubscriptionPlan | null;
  currentPeriodEnd: string | null;
  status: string | null;
  refresh: () => void;
  redirectToCheckout: (planSlug: string) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setActive(false);
      setPlan(null);
      setCurrentPeriodEnd(null);
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/subscription/status?userId=${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setActive(data.active ?? false);
        setPlan(data.plan ?? null);
        setCurrentPeriodEnd(data.endDate ?? null);
        setStatus(data.active ? "active" : "inactive");
      } else {
        setActive(false);
      }
    } catch {
      setActive(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    fetchStatus();
  }, [authLoading, fetchStatus]);

  // Re-check subscription when returning from payment gateway
  useEffect(() => {
    const handleFocus = () => {
      if (user) fetchStatus();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, fetchStatus]);

  const redirectToCheckout = useCallback(
    async (planSlug: string) => {
      if (!user) return;

      try {
        const res = await fetch("/api/subscription/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planSlug,
            userId: user.uid,
            userEmail: user.email,
            userName: user.displayName,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
          }
        }
      } catch (error) {
        console.error("Checkout redirect error:", error);
      }
    },
    [user]
  );

  return (
    <SubscriptionContext.Provider
      value={{ active, loading, plan, currentPeriodEnd, status, refresh: fetchStatus, redirectToCheckout }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
