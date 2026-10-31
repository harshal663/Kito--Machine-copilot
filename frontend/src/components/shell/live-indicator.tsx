"use client";

import { useLiveUpdates } from "@/lib/live-updates";
import { cn } from "@/lib/utils";

export function LiveIndicator() {
  const { connectionState } = useLiveUpdates();

  const status =
    connectionState === "OPEN"
      ? "connected"
      : connectionState === "CONNECTING"
      ? "connecting"
      : "disconnected";

  const config = {
    connected: {
      label: "Live",
      dotClass: "bg-emerald-500 animate-pulse",
      textClass: "text-emerald-700 dark:text-emerald-400",
      bgClass: "bg-emerald-500/10 border-emerald-500/20",
    },
    connecting: {
      label: "Reconnecting",
      dotClass: "bg-amber-500 animate-ping",
      textClass: "text-amber-700 dark:text-amber-400",
      bgClass: "bg-amber-500/10 border-amber-500/20",
    },
    disconnected: {
      label: "Offline",
      dotClass: "bg-slate-400",
      textClass: "text-slate-600 dark:text-slate-400",
      bgClass: "bg-slate-500/10 border-slate-500/20",
    },
  }[status];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        config.bgClass
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
      <span className={config.textClass}>{config.label}</span>
    </div>
  );
}
