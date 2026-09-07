import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <div className="mx-auto max-w-3xl space-y-4 px-5 py-16" aria-busy="true"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-64" /></div>;
}
