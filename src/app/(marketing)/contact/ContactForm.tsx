"use client";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendContact } from "@/lib/app/api";
import { track } from "@/lib/analytics";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), subject: String(fd.get("subject") ?? ""), message: String(fd.get("message") ?? ""), website: String(fd.get("website") ?? "") };
    if (body.message.trim().length < 10) { toast.error("Please write at least 10 characters."); return; }
    setBusy(true);
    try {
      await sendContact(body);
      setSent(true);
      track("contact_submit");
      toast.success("Message sent — we'll reply within 24–48 hours.");
    } catch (err) {
      toast.error((err as Error).message || "Could not send your message.");
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center rounded-card border border-line bg-card p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-ok/12 text-ok"><Send className="size-5" /></span>
        <h2 className="mt-4 text-lg font-semibold text-text-1">Thanks — message received</h2>
        <p className="mt-1 text-sm text-text-2">We typically reply within 24–48 hours.</p>
        <Button variant="outline" className="mt-5" onClick={() => setSent(false)}>Send another</Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="rounded-card border border-line bg-card p-6" noValidate>
      <h2 className="text-lg font-semibold text-text-1">Send us a message</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" name="name" required maxLength={80} placeholder="Your name" autoComplete="name" /></div>
        <div className="grid gap-1.5"><Label htmlFor="c-email">Email</Label><Input id="c-email" name="email" type="email" required maxLength={200} placeholder="you@example.com" autoComplete="email" /></div>
        <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="c-subject">Subject</Label><Input id="c-subject" name="subject" required maxLength={120} placeholder="What's this about?" /></div>
        <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="c-message">Message</Label><Textarea id="c-message" name="message" required minLength={10} maxLength={4000} rows={6} placeholder="Tell us what's on your mind…" /></div>
        <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-text-3">We only use your email to reply.</p>
        <Button type="submit" variant="brand" loading={busy}><Send className="size-4" /> Send message</Button>
      </div>
    </form>
  );
}
