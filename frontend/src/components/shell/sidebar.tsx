"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  BellRing,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  className?: string;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/machines", label: "Machines", icon: Cpu },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/factory", label: "Factory", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  className,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col justify-between border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]",
        className
      )}
    >
      <div>
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link
            href="/dashboard"
            onClick={onNavigate ? () => onNavigate() : () => {}}
            className="flex items-center gap-2.5 font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded-md min-h-[44px]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            {!collapsed && (
              <span className="text-base font-semibold tracking-tight">Machine Copilot</span>
            )}
          </Link>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav className="space-y-1.5 p-3" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/" || pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate ? () => onNavigate() : () => {}}
                title={collapsed ? item.label : ""}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ring",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : "")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / System status info */}
      {!collapsed && (
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Edge-to-Voice Copilot</p>
          <p className="mt-0.5">Continuous shop floor monitoring</p>
        </div>
      )}
    </aside>
  );
}
