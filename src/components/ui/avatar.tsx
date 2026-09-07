"use client";
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return <AvatarPrimitive.Root data-slot="avatar" className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full bg-surface-2", className)} {...props} />;
}
function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image data-slot="avatar-image" referrerPolicy="no-referrer" className={cn("aspect-square size-full object-cover", className)} {...props} />;
}
function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return <AvatarPrimitive.Fallback data-slot="avatar-fallback" className={cn("flex size-full items-center justify-center rounded-full bg-brand-soft text-xs font-semibold uppercase text-brand", className)} {...props} />;
}

export function initialsOf(name?: string | null, fallback = "U"): string {
  const n = (name ?? "").trim();
  if (!n) return fallback;
  return n.split(/\s+/).map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

/** Avatar with image + initials fallback in one go. */
function UserAvatar({ src, name, className, size }: { src?: string | null; name?: string | null; className?: string; size?: number }) {
  return (
    <Avatar className={className} style={size ? { width: size, height: size } : undefined}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback style={size ? { fontSize: Math.max(10, Math.round(size * 0.38)) } : undefined}>{initialsOf(name)}</AvatarFallback>
    </Avatar>
  );
}

export { Avatar, AvatarImage, AvatarFallback, UserAvatar };
