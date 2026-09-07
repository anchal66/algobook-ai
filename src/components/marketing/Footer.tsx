import Link from "next/link";
import { Logo } from "@/components/design/Logo";

const COLS = [
  { title: "Product", links: [{ href: "/#product", label: "Features" }, { href: "/#demo", label: "Live demo" }, { href: "/#pricing", label: "Pricing" }, { href: "/#compare", label: "vs LeetCode" }, { href: "/#faq", label: "FAQ" }] },
  { title: "Practice", links: [{ href: "/explore", label: "Explore problems" }, { href: "/daily", label: "Daily challenge" }, { href: "/leaderboard", label: "Leaderboard" }, { href: "/interview", label: "Mock interview" }] },
  { title: "Company", links: [{ href: "/about", label: "About" }, { href: "/contact", label: "Contact" }, { href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }] },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface-1">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo size={28} />
          <p className="mt-4 max-w-xs text-sm text-text-2">AI-verified interview practice with a LeetCode-parity editor, an AI tutor and a rating — in Java, Python, C++ and JavaScript.</p>
          <p className="mt-4 text-xs text-text-3">Built by CognitiveSquad · India</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">{c.title}</h3>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => <li key={l.href}><Link href={l.href} className="text-sm text-text-2 transition-colors hover:text-text-1">{l.label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 py-5 text-xs text-text-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} AlgoBook. All rights reserved.</p>
          <p>Prices in INR. Pro renews manually — no auto-deduction.</p>
        </div>
      </div>
    </footer>
  );
}
