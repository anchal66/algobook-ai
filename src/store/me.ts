"use client";
/** `/api/me` cache for the workspace: plan, quotas, stats, settings hydration (Module 03). */
import { create } from "zustand";
import type { FeatureKey } from "@/types";
import type { MeResponse } from "@/lib/workspace/types";
import { getMe } from "@/lib/workspace/api";
import { useSettings } from "@/store/settings";

interface MeState {
  me: MeResponse | null;
  loading: boolean;
  loadedFor: string | null;
  error: string | null;
  reset: () => void;
  load: (uid: string, force?: boolean) => Promise<MeResponse | null>;
  bumpQuota: (feature: FeatureKey) => void;
  patchStats: (patch: Partial<MeResponse["user"]["stats"]>) => void;
}

let inflight: Promise<MeResponse | null> | null = null;

export const useMe = create<MeState>()((set, get) => ({
  me: null,
  loading: false,
  loadedFor: null,
  error: null,
  reset: () => set({ me: null, loading: false, loadedFor: null, error: null }),
  load: async (uid, force) => {
    if (!force && get().loadedFor === uid && get().me) return get().me;
    if (inflight) return inflight;
    // A different account than the cached one: never show the previous user's data.
    if (get().loadedFor && get().loadedFor !== uid) set({ me: null, loadedFor: null });
    set({ loading: true, error: null });
    inflight = getMe()
      .then((me) => {
        set({ me, loading: false, loadedFor: uid, error: null });
        useSettings.getState().hydrateFromServer(me.user.settings);
        return me;
      })
      .catch((e: unknown) => { set({ loading: false, error: (e as Error)?.message ?? "Could not load your account" }); return null; })
      .finally(() => { inflight = null; });
    return inflight;
  },
  bumpQuota: (feature) => set((s) => {
    if (!s.me) return s;
    const used = { ...s.me.quotas.used, [feature]: (s.me.quotas.used[feature] ?? 0) + 1 };
    return { me: { ...s.me, quotas: { ...s.me.quotas, used } } };
  }),
  patchStats: (patch) => set((s) => (s.me ? { me: { ...s.me, user: { ...s.me.user, stats: { ...s.me.user.stats, ...patch } } } } : s)),
}));

/** Remaining calls for a feature today; `Infinity` when unlimited, 0 when not in the plan. */
export function quotaLeft(me: MeResponse | null, feature: FeatureKey): number {
  if (!me) return 0;
  const limit = me.quotas.limits[feature];
  if (limit === -1) return Infinity;
  return Math.max(0, limit - (me.quotas.used[feature] ?? 0));
}

export function isPro(me: MeResponse | null): boolean {
  return me?.plan.tier === "pro";
}
