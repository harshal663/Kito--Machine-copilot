"use client";

import { Menu } from "lucide-react";
import { LiveIndicator } from "./live-indicator";
import { ProfileMenu } from "./profile-menu";

interface HeaderProps {
  title?: string | undefined;
  onOpenMobileMenu?: (() => void) | undefined;
}

export function Header({ title = "Dashboard", onOpenMobileMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:px-6 shadow-2xs">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <LiveIndicator />
        <ProfileMenu />
      </div>
    </header>
  );
}
