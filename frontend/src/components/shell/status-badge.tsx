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
      label: "Healthy",
      icon: CheckCircle2,
      badgeClass:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
    },
    ALERT: {
      label: "Alert",
      icon: AlertTriangle,
      badgeClass:
        "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50",
    },
    LEARNING: {
      label: "Learning",
      icon: RefreshCw,
      badgeClass:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
    },
    OFFLINE: {
      label: "Offline",
      icon: WifiOff,
      badgeClass:
        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    },
  }[normalized] || {
    label: normalized || "Unknown",
    icon: CheckCircle2,
    badgeClass: "bg-muted text-muted-foreground border-border",
  };

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold select-none",
        config.badgeClass,
        className
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
}

