"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
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

const CACHE_KEY = "algobook_sub_cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedSub {
  active: boolean;
  plan: SubscriptionPlan | null;
  endDate: string | null;
  ts: number;
}

function readCache(uid: string): CachedSub | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSub & { uid: string };
    if (parsed.uid !== uid) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(uid: string, data: CachedSub) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, uid }));
  } catch { /* ignore quota errors */ }
}

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const hasCacheHydrated = useRef(false);

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
      const res = await fetch(`/api/subscription/status?userId=${encodeURIComponent(user.uid)}`);
      if (res.ok) {
        const data = await res.json();
        const isActive = data.active ?? false;
        setActive(isActive);
        setPlan(data.plan ?? null);
        setCurrentPeriodEnd(data.endDate ?? null);
        setStatus(isActive ? "active" : "inactive");
        writeCache(user.uid, { active: isActive, plan: data.plan ?? null, endDate: data.endDate ?? null, ts: Date.now() });
      } else {
        setActive(false);
      }
    } catch {
      setActive(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Hydrate from cache immediately when user is known
  useEffect(() => {
    if (authLoading || !user || hasCacheHydrated.current) return;
    hasCacheHydrated.current = true;
    const cached = readCache(user.uid);
    if (cached) {
      setActive(cached.active);
      setPlan(cached.plan);
      setCurrentPeriodEnd(cached.endDate);
      setStatus(cached.active ? "active" : "inactive");
      setLoading(false);
    }
  }, [authLoading, user]);

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
