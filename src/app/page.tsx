"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until loading is false
    if (!loading) {
      if (user) {
        // If the user is authenticated, send them to create a project
        router.push("/projects/new");
      } else {
        // This case is handled by AuthProvider, but as a fallback:
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  // Display a loading spinner while checking auth state
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}