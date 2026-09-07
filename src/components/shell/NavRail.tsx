"use client";
/** Left nav rail (Module 05 §1): 64 px icon rail that expands to show labels on hover/focus. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/design/Logo";
import { NAV_ITEMS, isActive } from "@/components/shell/nav";
import { useMe } from "@/store/me";
import { cn } from "@/lib/utils";

export function NavRail() {
  const path = usePathname();
  const isAdmin = useMe((s) => s.me?.isAdmin ?? false);
  const items = NAV_ITEMS.filter((n) => !n.admin || isAdmin);
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "group/rail fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r border-line bg-surface-1/95 backdrop-blur-xl transition-[width] duration-200 ease-out-quart lg:flex",
        "hover:w-56 focus-within:w-56 hover:shadow-[24px_0_48px_-32px_rgba(0,0,0,0.5)]",
      )}
    >
      <Link href="/dashboard" className="flex h-14 items-center gap-3 px-4" aria-label="AlgoBook dashboard">
        <LogoMark size={28} tone="brand" />
        <span className="whitespace-nowrap text-md font-semibold tracking-tight text-text-1 opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
          Algo<span className="text-gradient">Book</span>
        </span>
      </Link>
      <ul className="mt-2 flex flex-1 flex-col gap-1 px-2">
        {items.map((item) => {
          const active = isActive(item, path);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-3 overflow-hidden rounded-[10px] px-3 text-sm font-medium transition-colors duration-150",
                  active ? "bg-brand-soft text-brand" : "text-text-2 hover:bg-surface-2 hover:text-text-1",
                )}
              >
                {active && <span aria-hidden className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-brand" />}
                <item.icon className="size-5 shrink-0" strokeWidth={active ? 2.2 : 1.9} />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="px-4 pb-4 text-2xs text-text-3 opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
        <p className="whitespace-nowrap">© {new Date().getFullYear()} AlgoBook</p>
      </div>
    </nav>
  );
}
