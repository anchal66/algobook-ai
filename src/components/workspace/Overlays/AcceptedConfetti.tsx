"use client";
/** Fires a 1.2 s confetti burst on mount (Module 03 W-12). Skipped under prefers-reduced-motion. */
import { useEffect } from "react";

export function AcceptedConfetti() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    (async () => {
      const { default: confetti } = await import("canvas-confetti");
      if (cancelled) return;
      const end = Date.now() + 1200;
      const colors = ["#2cbb5d", "#22d3ee", "#6366f1", "#ffc01e"];
      const frame = () => {
        confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true });
        confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true });
        if (Date.now() < end && !cancelled) raf = requestAnimationFrame(frame);
      };
      let raf = requestAnimationFrame(frame);
      stop = () => cancelAnimationFrame(raf);
    })();
    return () => { cancelled = true; stop?.(); };
  }, []);
  return null;
}
