import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/design/Logo";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div className="aurora opacity-50" aria-hidden><i /><i /><i /></div>
      <div className="relative">
        <Link href="/" aria-label="AlgoBook home" className="inline-flex"><Logo size={32} /></Link>
        <p className="mt-10 font-mono text-sm text-brand">404 · NOT_FOUND</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-1">This page returned <span className="text-gradient">null</span>.</h1>
        <p className="mx-auto mt-3 max-w-md text-base text-text-2">The link may be wrong, the problem may have been retired, or the profile is private.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="brand" size="lg"><Link href="/dashboard">Go to dashboard</Link></Button>
          <Button asChild variant="outline" size="lg"><Link href="/explore">Explore problems</Link></Button>
        </div>
      </div>
    </main>
  );
}
