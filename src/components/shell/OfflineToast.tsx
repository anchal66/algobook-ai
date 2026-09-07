"use client";
import { useEffect } from "react";
import { toast } from "sonner";

/** Offline / back-online toasts (Module 05 U-22). */
export function OfflineToast() {
  useEffect(() => {
    const id = "net";
    const off = () => toast.warning("You're offline — runs and submits will fail until you reconnect.", { id, duration: Infinity });
    const on = () => toast.success("Back online", { id, duration: 2500 });
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    if (!navigator.onLine) off();
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, []);
  return null;
}
