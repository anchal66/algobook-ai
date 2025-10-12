"use client";

import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/button";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { useEffect } from "react";

// You need to install react-icons: npm install react-icons
export default function LoginPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google: ", error);
    }
  };

  useEffect(() => {
    if (user) {
      router.push("/"); // Redirect to the main page after successful login
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (user) {
    return null; // Don't render anything while redirecting
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold tracking-tight mb-2">AlgoBook</h1>
        <p className="text-muted-foreground">
          Your smart, personalized coding practice partner.
        </p>
      </div>
      <Button
        onClick={handleSignIn}
        className="flex items-center gap-3 px-6 py-6 text-lg"
      >
        <FcGoogle className="h-6 w-6" />
        Sign in with Google
      </Button>
    </main>
  );
}