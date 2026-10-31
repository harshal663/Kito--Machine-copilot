import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  initials?: string;
  name?: string;
}

export function Avatar({ initials, name, className, ...props }: AvatarProps) {
  const displayInitials =
    initials ||
    (name
      ? name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : "U");

  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary select-none",
        className
      )}
      {...props}
    >
      <span>{displayInitials}</span>
    </div>
  );
}

