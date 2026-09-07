"use client";
import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/design/Logo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <Link href="/" aria-label="AlgoBook home" className="inline-flex"><Logo size={32} /></Link>
      <p className="mt-10 font-mono text-sm text-err">RUNTIME_ERROR{error.digest ? ` · ${error.digest}` : ""}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-1">Something threw.</h1>
      <p className="mx-auto mt-3 max-w-md text-base text-text-2">{error.message || "An unexpected error occurred."} Your progress is saved server-side — retrying is safe.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="brand" size="lg" onClick={() => reset()}><RotateCcw className="size-4" /> Try again</Button>
        <Button asChild variant="outline" size="lg"><Link href="/dashboard">Dashboard</Link></Button>
      </div>
    </main>
  );
}
