"use client";
/** Session health (Module 03 W-24): ports `lib/session-tracker.ts`, kept in sessionStorage for the tab's lifetime. */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { computeSessionHealth, createSession, recordAttempt, type SessionState } from "@/lib/session-tracker";
import type { SessionHealth } from "@/types/legacy";

interface SessionStore {
  session: SessionState;
  lastSuggestionAt: number | null;
  record: (passed: boolean, hintsUsed: number, solveTimeSeconds: number) => void;
  health: () => SessionHealth;
  markSuggested: () => void;
  reset: () => void;
}

export const useSession = create<SessionStore>()(
  persist(
    (set, get) => ({
      session: createSession(),
      lastSuggestionAt: null,
      record: (passed, hintsUsed, solveTimeSeconds) => set({ session: recordAttempt(get().session, passed, hintsUsed, solveTimeSeconds) }),
      health: () => computeSessionHealth(get().session),
      markSuggested: () => set({ lastSuggestionAt: Date.now() }),
      reset: () => set({ session: createSession(), lastSuggestionAt: null }),
    }),
    { name: "algobook:session", storage: createJSONStorage(() => sessionStorage) },
  ),
);
