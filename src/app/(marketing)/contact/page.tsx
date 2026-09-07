import type { Metadata } from "next";
import { Clock, Mail, MapPin } from "lucide-react";
import { ContactForm } from "@/app/(marketing)/contact/ContactForm";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with the AlgoBook team." };

const CARDS = [
  { icon: Mail, title: "Email us", text: "For general enquiries, support or feedback", value: <a href="mailto:contact@cognitivesquad.com" className="text-brand underline underline-offset-2">contact@cognitivesquad.com</a> },
  { icon: Clock, title: "Response time", text: "We typically respond within", value: "24–48 hours" },
  { icon: MapPin, title: "Location", text: "CognitiveSquad HQ", value: "India" },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand">Contact</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-1">We&rsquo;d love to hear from you</h1>
      <p className="mt-3 max-w-2xl text-md text-text-2">Have a question, a suggestion or feedback about a problem? Reach out and we&rsquo;ll get back to you as soon as possible.</p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {CARDS.map((c) => (
            <div key={c.title} className="rounded-card border border-line bg-card p-5">
              <span className="flex size-9 items-center justify-center rounded-[8px] bg-brand-soft text-brand"><c.icon className="size-4.5" /></span>
              <h2 className="mt-3 text-md font-semibold text-text-1">{c.title}</h2>
              <p className="mt-1 text-sm text-text-2">{c.text}</p>
              <p className="mt-1 text-sm font-medium text-text-1">{c.value}</p>
            </div>
          ))}
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
