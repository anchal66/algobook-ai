"use client";
/** Transparent marketing top nav (Module 05 §1): logo · Product · Pricing · FAQ · About · theme · Sign in / Dashboard. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/design/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

export function MarketingNav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-200", scrolled || open ? "border-b border-line/70 bg-background/75 backdrop-blur-xl" : "border-b border-transparent")}>
      <a href="#main" className="skip-link">Skip to content</a>
      <nav aria-label="Marketing" className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="AlgoBook home" className="shrink-0"><Logo size={28} /></Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}><Link href={l.href} className="rounded-[8px] px-3 py-2 text-sm font-medium text-text-1/90 transition-colors hover:bg-surface-2 hover:text-text-1">{l.label}</Link></li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {user ? (
            <Button asChild variant="brand" size="sm"><Link href="/dashboard">Open dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="text-text-1"><Link href="/login">Sign in</Link></Button>
              <Button asChild variant="brand" size="sm"><Link href="/login">Start free</Link></Button>
            </>
          )}
        </div>
        <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex size-10 items-center justify-center rounded-[8px] text-text-1 md:hidden">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-line bg-background px-5 py-4 md:hidden">
          <ul className="flex flex-col">
            {LINKS.map((l) => <li key={l.href}><Link href={l.href} onClick={() => setOpen(false)} className="block rounded-[8px] px-3 py-2.5 text-base font-medium text-text-1 hover:bg-surface-2">{l.label}</Link></li>)}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <ThemeToggle showLabel />
            <Button asChild variant="brand" className="ml-auto"><Link href={user ? "/dashboard" : "/login"}>{user ? "Open dashboard" : "Start free"}</Link></Button>
          </div>
        </div>
      )}
    </header>
  );
}
