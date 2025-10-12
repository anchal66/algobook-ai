"use client";

import { createContext, useContext, ReactNode, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { User } from "firebase/auth";
import { useRouter } from "next/navigation";

// Define the shape of the context data
interface AuthContextType {
  user: User | null | undefined;
  loading: boolean;
  error?: Error;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    // If loading is finished and there's no user, redirect to login
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const value = { user, loading, error };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Create a custom hook for easy access to the context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}