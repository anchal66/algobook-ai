"use client";
/** ⌘K command palette (Module 05 U-09): pages, projects, problem search, actions. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { signOut } from "firebase/auth";
import { ArrowRight, Dices, FolderKanban, LogOut, Moon, Plus, Search, Sun } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useMe } from "@/store/me";
import { useQuery, clearQueries } from "@/lib/app/query";
import { exploreProblems, listProjects, randomProblem, type ExploreItem } from "@/lib/app/api";
import { NAV_ITEMS } from "@/components/shell/nav";
import { DifficultyBadge } from "@/components/ui/badge";
import { useThemePref } from "@/components/shell/ThemeToggle";
import { cn } from "@/lib/utils";

interface Ctx { open: boolean; setOpen: (v: boolean) => void; toggle: () => void }
const PaletteCtx = createContext<Ctx>({ open: false, setOpen: () => {}, toggle: () => {} });
export const useCommandPalette = () => useContext(PaletteCtx);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // The workspace binds ⌘K to its own drawer; only intercept outside it.
        if (document.querySelector(".ws-root")) return;
        e.preventDefault(); toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);
  return (
    <PaletteCtx.Provider value={value}>
      {children}
      <PaletteDialog />
    </PaletteCtx.Provider>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function PaletteDialog() {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const { user } = useAuth();
  const me = useMe((s) => s.me);
  const { theme, set: setTheme } = useThemePref();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 200);
  const signedIn = !!user;

  const projects = useQuery(signedIn && open ? "/api/projects" : null, listProjects, { staleMs: 60_000 });
  const problems = useQuery(signedIn && open && dq.length >= 2 ? `/api/problems?q=${encodeURIComponent(dq)}&limit=8` : null, () => exploreProblems({ q: dq, limit: 8 }), { staleMs: 60_000 });

  const close = () => { setOpen(false); setQ(""); };
  const onOpenChange = (v: boolean) => { if (v) setOpen(true); else close(); };
  const go = (href: string) => { close(); router.push(href); };
  const pick = async () => {
    close();
    try { const r = await randomProblem(); if (r.item) router.push(`/problems/${r.item.slug}`); } catch { /* ignore */ }
  };
  const logout = async () => { close(); clearQueries(); await signOut(auth); router.push("/"); };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-modal border border-line bg-popover shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command label="Command palette" shouldFilter={!dq || dq.length < 2 ? true : false} className="flex max-h-[70vh] flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-text-3" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder="Search problems, projects, pages…"
                className="h-12 w-full bg-transparent text-md text-text-1 placeholder:text-text-3 outline-none"
              />
              <kbd className="hidden rounded-[6px] border border-line px-1.5 py-0.5 text-2xs text-text-3 sm:inline">esc</kbd>
            </div>
            <Command.List className="scroll-thin overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-text-3">No results.</Command.Empty>

              {problems.data?.items?.length ? (
                <Command.Group heading="Problems" className={groupCls}>
                  {problems.data.items.map((p: ExploreItem) => (
                    <Command.Item key={p.id} value={`problem-${p.id}`} onSelect={() => go(`/problems/${p.slug}`)} className={itemCls}>
                      <span className="w-10 shrink-0 text-xs tabular text-text-3">{p.number ? `#${p.number}` : ""}</span>
                      <span className="flex-1 truncate">{p.title}</span>
                      <DifficultyBadge difficulty={p.difficulty} size="sm" />
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {signedIn && (
                <Command.Group heading="Pages" className={groupCls}>
                  {NAV_ITEMS.filter((n) => !n.admin || me?.isAdmin).map((n) => (
                    <Command.Item key={n.href} value={`page ${n.label}`} onSelect={() => go(n.href)} className={itemCls}>
                      <n.icon className="size-4 text-text-3" />
                      <span className="flex-1">{n.label}</span>
                      <ArrowRight className="size-3.5 text-text-3" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {signedIn && projects.data?.projects?.length ? (
                <Command.Group heading="Projects" className={groupCls}>
                  {projects.data.projects.slice(0, 8).map((p) => (
                    <Command.Item key={p.id} value={`project ${p.title}`} onSelect={() => go(`/project/${p.id}`)} className={itemCls}>
                      <FolderKanban className="size-4 text-text-3" />
                      <span className="flex-1 truncate">{p.title}</span>
                      <span className="text-xs tabular text-text-3">{p.progress.solved}/{p.progress.items}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              <Command.Group heading="Actions" className={groupCls}>
                {signedIn && (
                  <Command.Item value="action new project" onSelect={() => go("/projects/new")} className={itemCls}><Plus className="size-4 text-text-3" /> New project</Command.Item>
                )}
                {signedIn && (
                  <Command.Item value="action random problem pick one for me" onSelect={() => void pick()} className={itemCls}><Dices className="size-4 text-text-3" /> Pick a random problem</Command.Item>
                )}
                <Command.Item value="action toggle theme dark light" onSelect={() => { setTheme(theme === "dark" ? "light" : "dark"); close(); }} className={itemCls}>
                  {theme === "dark" ? <Sun className="size-4 text-text-3" /> : <Moon className="size-4 text-text-3" />} Switch to {theme === "dark" ? "light" : "dark"} theme
                </Command.Item>
                {signedIn && (
                  <Command.Item value="action sign out logout" onSelect={() => void logout()} className={itemCls}><LogOut className="size-4 text-text-3" /> Sign out</Command.Item>
                )}
                {!signedIn && (
                  <Command.Item value="action sign in login" onSelect={() => go("/login")} className={itemCls}><ArrowRight className="size-4 text-text-3" /> Sign in</Command.Item>
                )}
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-2xs text-text-3">
              <span><kbd className={kbdCls}>↑↓</kbd> navigate</span>
              <span><kbd className={kbdCls}>↵</kbd> open</span>
              <span className="ml-auto">AlgoBook</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const groupCls = "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-3";
const itemCls = cn("flex h-10 cursor-pointer select-none items-center gap-3 rounded-[8px] px-2 text-sm text-text-1 outline-none", "data-[selected=true]:bg-surface-2 data-[disabled=true]:opacity-50");
const kbdCls = "rounded-[4px] border border-line px-1 py-px";
