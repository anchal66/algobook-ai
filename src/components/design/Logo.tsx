import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * AlgoBook logo mark (Module 05 U-02, D-08): a bracket-shaped "A" — two angled strokes that read
 * both as the letter and as `< >` — with a glowing gradient node where the crossbar would sit.
 * `tone="mono"` draws the strokes in `currentColor`; `tone="brand"` draws them in the gradient.
 */
export interface LogoMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  tone?: "mono" | "brand" | "onBrand";
}

export function LogoMark({ size = 28, tone = "mono", className, ...rest }: LogoMarkProps) {
  const id = useId().replace(/:/g, "");
  const grad = `ab-grad-${id}`;
  const glow = `ab-glow-${id}`;
  const stroke = tone === "brand" ? `url(#${grad})` : tone === "onBrand" ? "#ffffff" : "currentColor";
  const node = tone === "onBrand" ? "#ffffff" : `url(#${grad})`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
      {...rest}
    >
      <defs>
        <linearGradient id={grad} x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Left bracket leg */}
      <path d="M13.5 5.5 5 16l8.5 10.5" stroke={stroke} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Right bracket leg */}
      <path d="M18.5 5.5 27 16l-8.5 10.5" stroke={stroke} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Apex joining the legs into an "A" */}
      <path d="M13.5 5.5h5" stroke={stroke} strokeWidth="3.4" strokeLinecap="round" />
      {/* Node */}
      <circle cx="16" cy="18" r="7" fill={`url(#${glow})`} />
      <circle cx="16" cy="18" r="3.2" fill={node} />
    </svg>
  );
}

export interface LogoProps {
  size?: number;
  className?: string;
  /** Hide the wordmark (icon only). */
  compact?: boolean;
  tone?: LogoMarkProps["tone"];
}

/** Mark + wordmark lockup used in the nav rail, marketing header and footer. */
export function Logo({ size = 28, className, compact, tone = "brand" }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-text-1", className)}>
      <LogoMark size={size} tone={tone} />
      {!compact && (
        <span className="font-semibold tracking-tight" style={{ fontSize: Math.round(size * 0.68) }}>
          Algo<span className="text-gradient">Book</span>
        </span>
      )}
    </span>
  );
}
