"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  User,
  CreditCard,
  Settings,
  Shield,
  FileText,
  Mail,
  Info,
  LogOut,
} from "lucide-react";

export default function UserMenu() {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (!user) return null;

  const initials = user.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full ring-2 ring-border hover:ring-primary/50 transition-all focus:outline-none">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="h-8 w-8 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {initials}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.displayName || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2 cursor-pointer">
          <User className="h-4 w-4" /> My Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 cursor-pointer">
          <Settings className="h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2 cursor-pointer">
          <CreditCard className="h-4 w-4" /> My Plan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/privacy")} className="gap-2 cursor-pointer">
          <Shield className="h-4 w-4" /> Privacy Policy
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/terms")} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" /> Terms of Service
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/contact")} className="gap-2 cursor-pointer">
          <Mail className="h-4 w-4" /> Contact Us
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/about")} className="gap-2 cursor-pointer">
          <Info className="h-4 w-4" /> About Us
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-red-400 focus:text-red-400">
          <LogOut className="h-4 w-4" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
