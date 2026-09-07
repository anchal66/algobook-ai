import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-background">
      <a href="#main" className="skip-link">Skip to content</a>
      <MarketingNav />
      <main id="main" className="pt-16">{children}</main>
      <Footer />
    </div>
  );
}

/** Prose container for legal/about pages. */
export function ProsePage({ title, updated, intro, children }: { title: string; updated?: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-text-1">{title}</h1>
        {updated && <p className="mt-2 text-sm text-text-3">Last updated: {updated}</p>}
        {intro && <p className="mt-4 text-md text-text-2">{intro}</p>}
      </header>
      <div className="prose-legal space-y-8 text-base text-text-2 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text-1 [&_h3]:mt-6 [&_h3]:text-md [&_h3]:font-semibold [&_h3]:text-text-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-text-1">
        {children}
      </div>
    </article>
  );
}
