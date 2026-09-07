"use client";
/** Avatar dropdown (restyled in Module 05; still imported by the workspace TopBar). */
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { CreditCard, FileText, Info, LogOut, Mail, Moon, Settings, Shield, Sun, User } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useMe } from "@/store/me";
import { clearQueries } from "@/lib/app/query";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useThemePref } from "@/components/shell/ThemeToggle";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function UserMenu({ size = 32 }: { size?: number }) {
  const { user } = useAuth();
  const me = useMe((s) => s.me);
  const router = useRouter();
  const { theme, set } = useThemePref();

  if (!user) return null;
  const pro = me?.plan.tier === "pro";
  const name = me?.user.displayName || user.displayName || "User";
  const username = me?.user.username;

  const handleSignOut = async () => {
    clearQueries();
    await signOut(auth);
    router.push("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="rounded-full ring-2 ring-transparent transition-shadow hover:ring-brand/50 focus:outline-none focus-visible:ring-brand"
        >
          <UserAvatar src={me?.user.photoURL || user.photoURL} name={name} size={size} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-[12px] border-line bg-popover p-1.5">
        <DropdownMenuLabel className="px-2 py-2 font-normal">
          <div className="flex items-center gap-3">
            <UserAvatar src={me?.user.photoURL || user.photoURL} name={name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-1">{name}</p>
              <p className="truncate text-xs text-text-3">{username ? `@${username}` : user.email}</p>
            </div>
            <Badge variant={pro ? "gradient" : "outline"} size="sm">{pro ? "Pro" : "Free"}</Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-line" />
        <Item onClick={() => router.push("/profile")} icon={<User />}>My profile</Item>
        <Item onClick={() => router.push("/settings")} icon={<Settings />}>Settings</Item>
        <Item onClick={() => router.push("/settings#plan")} icon={<CreditCard />}>{pro ? "Plan & billing" : "Upgrade to Pro"}</Item>
        <Item onClick={() => set(theme === "dark" ? "light" : "dark")} icon={theme === "dark" ? <Sun /> : <Moon />}>{theme === "dark" ? "Light theme" : "Dark theme"}</Item>
        <DropdownMenuSeparator className="bg-line" />
        <Item onClick={() => router.push("/about")} icon={<Info />}>About</Item>
        <Item onClick={() => router.push("/contact")} icon={<Mail />}>Contact</Item>
        <Item onClick={() => router.push("/privacy")} icon={<Shield />}>Privacy</Item>
        <Item onClick={() => router.push("/terms")} icon={<FileText />}>Terms</Item>
        <DropdownMenuSeparator className="bg-line" />
        <Item onClick={() => void handleSignOut()} icon={<LogOut />} className="text-err focus:text-err">Sign out</Item>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Item({ children, icon, onClick, className }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <DropdownMenuItem onClick={onClick} className={`h-9 cursor-pointer gap-2.5 rounded-[8px] px-2 text-sm text-text-1 focus:bg-surface-2 [&_svg]:size-4 [&_svg]:text-text-3 ${className ?? ""}`}>
      {icon}{children}
    </DropdownMenuItem>
  );
}
