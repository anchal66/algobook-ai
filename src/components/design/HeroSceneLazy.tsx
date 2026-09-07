"use client";
/** Lazy wrapper for HeroScene: static fallback first paint, device/WebGL gating, reduced-motion respect. */
import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/components/design/motion";
import { cn } from "@/lib/utils";

const HeroScene = dynamic(() => import("@/components/design/HeroScene"), { ssr: false, loading: () => null });

function canRun3D(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if ((nav.deviceMemory ?? 8) < 4) return false;
  if ((nav.hardwareConcurrency ?? 8) <= 2) return false;
  if (window.matchMedia("(max-width: 767px)").matches) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

/** Static graph illustration (inline SVG, themable) shown before hydration, on low-power devices and with reduced motion. */
export function HeroFallback({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={cn("h-full w-full", className)} role="img" aria-label="Illustration of a glowing knowledge graph">
      <defs>
        <linearGradient id="hf-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
        <radialGradient id="hf-glow"><stop offset="0" stopColor="#6366f1" stopOpacity="0.5" /><stop offset="1" stopColor="#6366f1" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="200" cy="200" r="190" fill="url(#hf-glow)" />
      <g stroke="url(#hf-g)" strokeOpacity="0.35" strokeWidth="1">
        {[[200,60,110,130],[200,60,290,130],[110,130,80,230],[290,130,320,230],[80,230,140,320],[320,230,260,320],[140,320,260,320],[110,130,200,200],[290,130,200,200],[200,200,140,320],[200,200,260,320],[80,230,200,200],[320,230,200,200],[200,60,200,200]].map(([x1,y1,x2,y2],i)=> <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
      </g>
      {[[200,60,7],[110,130,6],[290,130,6],[80,230,5],[320,230,5],[140,320,6],[260,320,6],[200,200,10]].map(([x,y,r],i)=> (
        <g key={i}><circle cx={x} cy={y} r={r*2.6} fill="url(#hf-glow)" /><circle cx={x} cy={y} r={r} fill="url(#hf-g)" /></g>
      ))}
      <g fill="#a5b4fc" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="14" fontWeight="600" opacity="0.8">
        <text x="40" y="90">{"{ }"}</text><text x="330" y="80">{"< >"}</text><text x="30" y="330">O(n)</text><text x="330" y="340">λ</text><text x="185" y="370">{"[ ]"}</text>
      </g>
    </svg>
  );
}

export function HeroSceneLazy({ className, compact }: { className?: string; compact?: boolean }) {
  const reduce = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Decide after mount: the fallback is the SSR/first paint; 3D loads behind it.
    const id = window.requestIdleCallback ? window.requestIdleCallback(() => setReady(canRun3D()), { timeout: 800 }) : window.setTimeout(() => setReady(canRun3D()), 120);
    return () => { if (window.cancelIdleCallback && typeof id === "number") window.cancelIdleCallback(id); else clearTimeout(id as number); };
  }, []);
  const show3D = ready && !reduce;
  return (
    <div className={cn("relative", className)} data-hero-3d={show3D ? "on" : "off"}>
      <div className={cn("absolute inset-0 transition-opacity duration-600", show3D ? "opacity-0" : "opacity-100")} aria-hidden={show3D}>
        <HeroFallback />
      </div>
      {show3D && (
        <div className="absolute inset-0 animate-in fade-in duration-600">
          <Suspense fallback={null}><HeroScene compact={compact} /></Suspense>
        </div>
      )}
    </div>
  );
}
