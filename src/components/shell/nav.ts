import { BarChart3, CalendarCheck, Compass, FolderKanban, LayoutDashboard, Mic2, Settings, ShieldCheck, Trophy, User, type LucideIcon } from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; admin?: boolean; match?: (path: string) => boolean }

/** Nav rail entries (Module 05 §1 layout shell). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/explore", label: "Explore", icon: Compass, match: (p) => p.startsWith("/explore") || p.startsWith("/problems") },
  { href: "/daily", label: "Daily", icon: CalendarCheck },
  { href: "/projects", label: "Projects", icon: FolderKanban, match: (p) => p.startsWith("/projects") || p.startsWith("/project/") },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/interview", label: "Interview", icon: Mic2 },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: ShieldCheck, admin: true },
];

export const SECONDARY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export { BarChart3 };

export function isActive(item: NavItem, path: string): boolean {
  return item.match ? item.match(path) : path === item.href || path.startsWith(item.href + "/");
}
