import { Logo } from "@/components/design/Logo";

/** Rendered by the root layout instead of the app when `MAINTENANCE=1` (Module 05 U-22). */
export function Maintenance() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div className="aurora opacity-50" aria-hidden><i /><i /><i /></div>
      <div className="relative">
        <Logo size={32} />
        <p className="mt-10 font-mono text-sm text-brand">503 · MAINTENANCE</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-1">We&rsquo;re upgrading the judge.</h1>
        <p className="mx-auto mt-3 max-w-md text-base text-text-2">AlgoBook is briefly down for maintenance. Your streak is safe — a maintenance day never breaks it. Back shortly.</p>
      </div>
    </main>
  );
}
