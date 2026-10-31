import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  subtext?: string;
  icon: React.ReactNode;
  statusVariant?: "default" | "healthy" | "alert" | "learning" | "offline";
  className?: string;
}

export function StatCard({
  label,
  value,
  subtext,
  icon,
  statusVariant = "default",
  className,
}: StatCardProps) {
  const variantStyles = {
    default: "border-border bg-card text-foreground",
    healthy: "border-status-healthy/30 bg-card text-foreground",
    alert: "border-status-alert/40 bg-card text-foreground",
    learning: "border-status-learning/30 bg-card text-foreground",
    offline: "border-status-offline/30 bg-card text-foreground",
  }[statusVariant];

  const iconStyles = {
    default: "bg-muted text-muted-foreground",
    healthy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    alert: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    learning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    offline: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  }[statusVariant];

  return (
    <div
      className={cn(
        "rounded-xl border p-5 shadow-sm transition-all hover:shadow-md",
        variantStyles,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconStyles)}>
          {icon}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {value}
        </p>
      </div>
      {subtext && (
        <p className="mt-1 text-xs text-muted-foreground">
          {subtext}
        </p>
      )}
    </div>
  );
}

