"use client";
/**
 * Motion kit (Module 05 U-05). Every component honours `prefers-reduced-motion` through framer's
 * `useReducedMotion`, and nothing in-app runs longer than 600 ms (Master Plan §8).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
export const DUR = { hover: 0.12, tab: 0.2, panel: 0.32, hero: 0.6 } as const;

// ── Reveal ──────────────────────────────────────────────────────────────────
export interface RevealProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  /** Delay in seconds (use with index for stagger). */
  delay?: number;
  /** Pixels of travel. */
  y?: number;
  once?: boolean;
  as?: "div" | "section" | "li" | "span" | "article";
}

/** In-view fade + slide. */
export function Reveal({ children, delay = 0, y = 16, once = true, className, as = "div", ...rest }: RevealProps) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: DUR.hero, ease: EASE, delay }}
      className={className}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Staggers direct children `Reveal`s by `step` seconds. */
export function Stagger({ children, step = 0.06, className, from = 0 }: { children: ReactNode[] | ReactNode; step?: number; className?: string; from?: number }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className={className}>
      {items.map((child, i) => (
        <Reveal key={i} delay={from + i * step}>{child}</Reveal>
      ))}
    </div>
  );
}

// ── AnimatedNumber ──────────────────────────────────────────────────────────
export function AnimatedNumber({ value, format, className, duration = 0.6 }: { value: number; format?: (n: number) => string; className?: string; duration?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-5% 0px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const defaultFmt = useCallback((n: number) => Math.round(n).toLocaleString(), []);
  const fmt = format ?? defaultFmt;
  const [text, setText] = useState(() => fmt(reduce ? value : 0));

  useEffect(() => {
    if (!inView) return;
    if (reduce) { mv.set(value); return; }
    mv.set(value);
  }, [inView, value, reduce, mv]);

  useEffect(() => spring.on("change", (v) => setText(fmt(v))), [spring, fmt]);

  return <span ref={ref} className={cn("tabular", className)}>{text}</span>;
}

// ── Magnetic ────────────────────────────────────────────────────────────────
/** Wraps a button; it leans towards the pointer within `radius` px. */
export function Magnetic({ children, strength = 0.3, className }: { children: ReactNode; strength?: number; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 20, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 300, damping: 20, mass: 0.4 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => { x.set(0); y.set(0); };

  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={reset} style={{ x: sx, y: sy }} className={cn("inline-block", className)}>
      {children}
    </motion.div>
  );
}

// ── TiltCard ────────────────────────────────────────────────────────────────
export function TiltCard({ children, className, max = 6, glare = true, style }: { children: ReactNode; className?: string; max?: number; glare?: boolean; style?: CSSProperties }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 200, damping: 20 });
  const glareX = useTransform(px, [0, 1], ["0%", "100%"]);
  const glareY = useTransform(py, [0, 1], ["0%", "100%"]);
  const glareBg = useTransform([glareX, glareY], ([gx, gy]) => `radial-gradient(400px circle at ${gx} ${gy}, rgba(255,255,255,0.10), transparent 60%)`);

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => { px.set(0.5); py.set(0.5); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ rotateX: reduce ? 0 : rx, rotateY: reduce ? 0 : ry, transformStyle: "preserve-3d", transformPerspective: 900, ...style }}
      className={cn("relative", className)}
    >
      {children}
      {glare && !reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ background: glareBg }}
        />
      )}
    </motion.div>
  );
}

// ── PageTransition ──────────────────────────────────────────────────────────
/** Route-level 200 ms fade/slide. Key it on the pathname from the layout. */
export function PageTransition({ children, className, id }: { children: ReactNode; className?: string; id: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={id}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.tab, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Shimmer ─────────────────────────────────────────────────────────────────
export function Shimmer({ className }: { className?: string }) {
  return <div aria-hidden className={cn("shimmer rounded-[8px]", className)} />;
}

// ── Presence helpers ────────────────────────────────────────────────────────
export const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: DUR.panel, ease: EASE } } } as const;
export const listStagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } } as const;
