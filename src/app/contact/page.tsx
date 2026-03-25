import type { Metadata } from "next";
import Link from "next/link";
import { Code2, ArrowLeft, Mail, MapPin, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the AlgoBook team — we'd love to hear from you.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Contact Us</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have a question, suggestion, or feedback? We&apos;d love to hear from you. Reach out and we&apos;ll get back to you as soon as possible.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Email Us</h3>
            <p className="text-sm text-muted-foreground mb-3">For general inquiries, support, or feedback</p>
            <a
              href="mailto:contact@cognitivesquad.com"
              className="text-sm text-primary hover:underline font-medium"
            >
              contact@cognitivesquad.com
            </a>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Response Time</h3>
            <p className="text-sm text-muted-foreground mb-3">We typically respond within</p>
            <p className="text-sm text-primary font-medium">24 — 48 hours</p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Location</h3>
            <p className="text-sm text-muted-foreground mb-3">CognitiveSquad HQ</p>
            <p className="text-sm text-primary font-medium">India</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-10 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">Send Us a Message</h2>
          <form
            action={`mailto:contact@cognitivesquad.com`}
            method="GET"
            className="space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Name</label>
                <input
                  type="text"
                  name="subject"
                  placeholder="Your name"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <input
                type="text"
                placeholder="What's this about?"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Message</label>
              <textarea
                name="body"
                rows={5}
                placeholder="Tell us what's on your mind..."
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <a
              href="mailto:contact@cognitivesquad.com"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Mail className="h-4 w-4" /> Send Email
            </a>
          </form>
        </div>
      </main>
    </div>
  );
}
