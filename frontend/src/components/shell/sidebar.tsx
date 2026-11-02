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
        "flex h-full flex-col justify-between border-r border-slate-200/90 bg-white transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]",
        className
      )}
    >
      <div>
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4">
          <Link
            href="/dashboard"
            onClick={onNavigate ? () => onNavigate() : () => {}}
            className="flex items-center gap-3 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ff5733] rounded-lg min-h-[44px]"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#ff4724] to-[#ff7347] text-white shadow-sm shadow-[#ff5733]/20 ring-2 ring-[#ff5733]/15">
              <Radio className="h-5 w-5 stroke-[2.2]" />
            </div>
            {!collapsed && (
              <span className="text-base font-bold tracking-tight text-slate-900">
                Machine Copilot
              </span>
            )}
          </Link>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[#ff5733]"
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
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#ff5733]",
                  isActive
                    ? "bg-[#ff5733] text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / System status info */}
      {!collapsed && (
        <div className="border-t border-slate-200/80 p-4 text-xs text-slate-500">
          <p className="font-semibold text-slate-800">Edge-to-Voice Copilot</p>
          <p className="mt-0.5 text-slate-400">Continuous shop floor monitoring</p>
        </div>
      )}
    </aside>
  );
}
