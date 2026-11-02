import * as React from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type MachineStatusType = "HEALTHY" | "ALERT" | "LEARNING" | "OFFLINE";

interface StatusBadgeProps {
  status: MachineStatusType | string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const normalized = (status || "").toUpperCase();

  const config = {
    HEALTHY: {
      dataStatus: "healthy",
      label: "Healthy",
      icon: CheckCircle2,
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    ALERT: {
      dataStatus: "alert",
      label: "Alert",
      icon: AlertTriangle,
      badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    },
    LEARNING: {
      dataStatus: "learning",
      label: "Learning",
      icon: RefreshCw,
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    },
    OFFLINE: {
      dataStatus: "offline",
      label: "Offline",
      icon: WifiOff,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    },
  }[normalized] || {
    dataStatus: "default",
    label: normalized || "Unknown",
    icon: CheckCircle2,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const Icon = config.icon;

  return (
    <span
      data-status={config.dataStatus}
      className={cn(
        "status-badge inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold select-none",
        config.badgeClass,
        className
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
}
