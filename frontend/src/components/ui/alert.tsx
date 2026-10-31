import React from "react";
import { cn } from "@/lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "danger";
}

export function Alert({
  className,
  variant = "info",
  children,
  ...props
}: AlertProps) {
  const variantStyles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    danger: "bg-red-50 border-red-200 text-red-900",
  };

  return (
    <div
      role="alert"
      className={cn("rounded-lg border p-4 text-sm", variantStyles[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5 className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props}>
      {children}
    </h5>
  );
}

export function AlertDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props}>
      {children}
    </div>
  );
}
