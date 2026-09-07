"use client";
/** Stopwatch / countdown timer (Module 03 W-23). Ticks once per second while running. */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatClock, timerElapsedMs, useWorkspace } from "@/store/workspace";
import { useSettings } from "@/store/settings";

export interface TimerApi {
  running: boolean;
  label: string;
  elapsedMs: number;
  mode: "stopwatch" | "countdown";
  start: () => void;
  pause: () => void;
  reset: () => void;
  toggle: () => void;
}

export function useTimer(): TimerApi {
  const timer = useWorkspace((s) => s.timer);
  const setTimer = useWorkspace((s) => s.setTimer);
  const mode = useSettings((s) => s.timer.mode);
  const countdownMin = useSettings((s) => s.timer.countdownMin);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer.running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  const elapsedMs = timerElapsedMs(timer, now);
  const countdownTotal = countdownMin * 60_000;
  const remaining = countdownTotal - elapsedMs;

  useEffect(() => {
    if (mode === "countdown" && timer.running && remaining <= 0) {
      setTimer({ running: false, accumulatedMs: countdownTotal, startedAt: null });
      toast("Time's up!", { description: "Your countdown finished. Submit when you are ready." });
    }
  }, [mode, timer.running, remaining, countdownTotal, setTimer]);

  const start = useCallback(() => { if (!useWorkspace.getState().timer.running) setTimer({ running: true, startedAt: Date.now() }); }, [setTimer]);
  const pause = useCallback(() => {
    const t = useWorkspace.getState().timer;
    if (t.running) setTimer({ running: false, accumulatedMs: timerElapsedMs(t), startedAt: null });
  }, [setTimer]);
  const reset = useCallback(() => setTimer({ running: false, accumulatedMs: 0, startedAt: null }), [setTimer]);
  const toggle = useCallback(() => { if (useWorkspace.getState().timer.running) pause(); else start(); }, [pause, start]);

  const label = mode === "countdown" ? formatClock(Math.max(0, remaining)) : formatClock(elapsedMs);
  return { running: timer.running, label, elapsedMs, mode, start, pause, reset, toggle };
}
