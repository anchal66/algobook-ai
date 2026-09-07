"use client";
/** Own profile (Module 05 U-16). */
import { useMe } from "@/store/me";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileView, profileFromMe } from "@/components/profile/ProfileView";

export default function ProfilePage() {
  const me = useMe((s) => s.me);
  if (!me) return <div className="grid gap-4 lg:grid-cols-[320px_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;
  return <ProfileView p={profileFromMe(me.user as Parameters<typeof profileFromMe>[0])} isOwner />;
}
