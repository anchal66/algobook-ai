"use client";
/**
 * App shell (Module 05 §1 / U-08): auth gate → nav rail + top bar + content container (max 1280).
 * Route-level transitions are keyed on the pathname (200 ms).
 */
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useMe } from "@/store/me";
import { NavRail } from "@/components/shell/NavRail";
import { TopBar } from "@/components/shell/TopBar";
import { PageTransition } from "@/components/design/motion";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LogoMark } from "@/components/design/Logo";
import { NAV_ITEMS, SECONDARY_LINKS, isActive } from "@/components/shell/nav";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AppShell({ children, width = "default" }: { children: ReactNode; width?: "default" | "wide" | "full" }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const load = useMe((s) => s.load);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else void load(user.uid);
  }, [loading, user, router, path, load]);

  if (loading || !user) return <ShellSkeleton />;

  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="skip-link">Skip to content</a>
      <NavRail />
      <div className="flex min-h-dvh flex-col lg:pl-16">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <main id="main" tabIndex={-1} className={cn("mx-auto w-full flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8", width === "default" && "max-w-[1280px]", width === "wide" && "max-w-[1440px]")}>
          <PageTransition id={path}>{children}</PageTransition>
        </main>
      </div>
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}

function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const path = usePathname();
  const isAdmin = useMe((s) => s.me?.isAdmin ?? false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 border-line bg-surface-1 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-14 items-center gap-2 px-4">
          <LogoMark size={26} tone="brand" />
          <span className="text-md font-semibold tracking-tight">Algo<span className="text-gradient">Book</span></span>
        </div>
        <nav aria-label="Primary" className="px-2">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.filter((n) => !n.admin || isAdmin).map((item) => {
              const active = isActive(item, path);
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => onOpenChange(false)} aria-current={active ? "page" : undefined} className={cn("flex h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium", active ? "bg-brand-soft text-brand" : "text-text-2 hover:bg-surface-2 hover:text-text-1")}>
                    <item.icon className="size-5" />{item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 px-5 text-xs text-text-3">
          {SECONDARY_LINKS.map((l) => <Link key={l.href} href={l.href} className="hover:text-text-1">{l.label}</Link>)}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-background" aria-busy="true" aria-label="Loading">
      <div className="hidden lg:block fixed inset-y-0 left-0 w-16 border-r border-line bg-surface-1" />
      <div className="lg:pl-16">
        <div className="h-14 border-b border-line" />
        <div className="mx-auto max-w-[1280px] space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}

/** Page header block used across app pages. */
export function PageHeader({ title, description, actions, eyebrow, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-3">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-text-1 sm:text-2xl">{title}</h1>
        {description && <div className="mt-1 max-w-2xl text-sm text-text-2">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
