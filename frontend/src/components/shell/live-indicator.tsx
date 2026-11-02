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
      state: "live",
      dotClass: "bg-emerald-500 animate-pulse",
      textClass: "text-emerald-700",
      bgClass: "bg-emerald-50 border-emerald-200",
    },
    connecting: {
      label: "Reconnecting",
      state: "reconnecting",
      dotClass: "bg-amber-500 animate-ping",
      textClass: "text-amber-700",
      bgClass: "bg-amber-50 border-amber-200",
    },
    disconnected: {
      label: "Offline",
      state: "offline",
      dotClass: "bg-slate-400",
      textClass: "text-slate-600",
      bgClass: "bg-slate-100 border-slate-200",
    },
  }[status];

  return (
    <div
      role="status"
      aria-live="polite"
      data-state={config.state}
      data-testid="live-indicator"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
        config.bgClass
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", config.dotClass)} aria-hidden="true" />
      <span className={config.textClass}>{config.label}</span>
    </div>
  );
}
