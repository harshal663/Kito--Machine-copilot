import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  subtext?: string;
  icon: React.ReactNode;
  statusVariant?: "default" | "healthy" | "alert" | "learning" | "offline";
  className?: string;
  testId?: string;
}

export function StatCard({
  label,
  value,
  subtext,
  icon,
  statusVariant = "default",
  className,
  testId,
}: StatCardProps) {
  const variantStyles = {
    default: "border-slate-200/90 bg-white text-slate-900",
    healthy: "border-emerald-200/80 bg-white text-slate-900",
    alert: "border-rose-200/80 bg-white text-slate-900",
    learning: "border-amber-200/80 bg-white text-slate-900",
    offline: "border-slate-200/80 bg-white text-slate-900",
  }[statusVariant];

  const iconStyles = {
    default: "bg-slate-100 text-slate-600",
    healthy: "bg-emerald-50 text-emerald-600",
    alert: "bg-rose-50 text-rose-600",
    learning: "bg-amber-50 text-amber-600",
    offline: "bg-slate-100 text-slate-500",
  }[statusVariant];

  return (
    <div
      data-testid={testId}
      data-status={statusVariant !== "default" ? statusVariant : undefined}
      className={cn(
        "rounded-2xl border p-5 shadow-xs transition-all hover:shadow-sm",
        variantStyles,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconStyles)}>
          {icon}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl" data-metric>
          {value}
        </p>
      </div>
      {subtext && (
        <p className="mt-1 text-xs text-slate-400 font-medium">
          {subtext}
        </p>
      )}
    </div>
  );
}
