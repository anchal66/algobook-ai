"use client";
/** Preset room avatar (D-18): a lucide icon on a hue-tinted tile. */
import { Brain, Crown, Flame, Gem, Puzzle, Rocket, Shield, Star, Swords, Target, Trophy, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvatarIcon } from "@/lib/rooms/settings";

export const AVATAR_ICON_MAP: Record<AvatarIcon, LucideIcon> = { swords: Swords, trophy: Trophy, flame: Flame, rocket: Rocket, zap: Zap, target: Target, crown: Crown, puzzle: Puzzle, brain: Brain, shield: Shield, star: Star, gem: Gem };

export function RoomAvatar({ icon, hue, size = 40, className }: { icon: string; hue: number; size?: number; className?: string }) {
  const Icon = AVATAR_ICON_MAP[icon as AvatarIcon] ?? Swords;
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-[12px] text-white shadow-inner", className)} style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 70% 42%))` }} aria-hidden>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
    </span>
  );
}
