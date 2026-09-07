"use client";
/**
 * Motion kit (Module 05 U-05), framer-free: Reveal/Stagger/AnimatedNumber/PageTransition/Shimmer run on CSS + a
 * shared IntersectionObserver + requestAnimationFrame so no animation library ships in the app pages' first load.
 * `prefers-reduced-motion` is honoured through the global CSS guard and `usePrefersReducedMotion`.
 * Pointer effects (Magnetic, TiltCard) live in `motion-fx.tsx` (framer-motion, lazy-loaded where used).
 */
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const EASE_CSS = "cubic-bezier(0.2, 0.8, 0.2, 1)";
export const DUR = { hover: 0.12, tab: 0.2, panel: 0.32, hero: 0.6 } as const;

// ── Reduced motion ──────────────────────────────────────────────────────────
const RM = "(prefers-reduced-motion: reduce)";
function subscribeRM(cb: () => void) { const m = window.matchMedia(RM); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); }
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeRM, () => window.matchMedia(RM).matches, () => false);
}

// ── Shared IntersectionObserver ─────────────────────────────────────────────
type Cb = (visible: boolean) => void;
let io: IntersectionObserver | null = null;
const cbs = new WeakMap<Element, Cb>();
function observe(el: Element, cb: Cb) {
  if (!io) io = new IntersectionObserver((entries) => { for (const e of entries) cbs.get(e.target)?.(e.isIntersecting); }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  cbs.set(el, cb); io.observe(el);
  return () => { cbs.delete(el); io?.unobserve(el); };
}
export function useInView<T extends Element>(once = true): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Already on screen at mount (above the fold): reveal on the next frame without waiting for IO.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) { const id = requestAnimationFrame(() => setInView(true)); if (once) return () => cancelAnimationFrame(id); }
    return observe(el, (v) => { if (v) setInView(true); else if (!once) setInView(false); });
  }, [once]);
  return [ref, inView];
}

// ── Reveal ──────────────────────────────────────────────────────────────────
export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  /** Delay in seconds (use with index for stagger). */
  delay?: number;
  /** Pixels of travel. */
  y?: number;
  once?: boolean;
  as?: "div" | "section" | "li" | "span" | "article";
}

/** In-view fade + slide (600 ms, ease-out-quart). Content is in the DOM and readable from the first paint; only opacity/transform animate. */
export function Reveal({ children, delay = 0, y = 16, once = true, className, as = "div", style, ...rest }: RevealProps) {
  const Comp = as as "div";
  const [ref, inView] = useInView<HTMLDivElement>(once);
  const reduce = usePrefersReducedMotion();
  const shown = inView || reduce;
  return (
    <Comp
      ref={ref}
      className={className}
      style={{ ...style, opacity: shown ? 1 : 0, transform: shown ? "none" : `translateY(${y}px)`, transition: `opacity ${DUR.hero}s ${EASE_CSS} ${delay}s, transform ${DUR.hero}s ${EASE_CSS} ${delay}s`, willChange: shown ? undefined : "opacity, transform" } as CSSProperties}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Staggers direct children by `step` seconds. */
export function Stagger({ children, step = 0.06, className, from = 0 }: { children: ReactNode[] | ReactNode; step?: number; className?: string; from?: number }) {
  const items = Array.isArray(children) ? children : [children];
  return <div className={className}>{items.map((child, i) => <Reveal key={i} delay={from + i * step}>{child}</Reveal>)}</div>;
}

// ── AnimatedNumber ──────────────────────────────────────────────────────────
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export function AnimatedNumber({ value, format, className, duration = 0.6 }: { value: number; format?: (n: number) => string; className?: string; duration?: number }) {
  const reduce = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLSpanElement>(true);
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString());
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) { setShown(value); fromRef.current = value; return; }
    const from = fromRef.current, start = performance.now(), ms = duration * 1000;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(from + (value - from) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick); else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduce, duration]);
  return <span ref={ref} className={cn("tabular", className)}>{fmt(inView ? shown : reduce ? value : 0)}</span>;
}

// ── PageTransition ──────────────────────────────────────────────────────────
/** Route-level 200 ms fade/slide via CSS keyframes; keyed on the pathname so it replays per navigation. */
export function PageTransition({ children, className, id }: { children: ReactNode; className?: string; id: string }) {
  return <div key={id} className={cn("animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-both", className)}>{children}</div>;
}

// ── Shimmer ─────────────────────────────────────────────────────────────────
export function Shimmer({ className }: { className?: string }) {
  return <div aria-hidden className={cn("shimmer rounded-[8px]", className)} />;
}
