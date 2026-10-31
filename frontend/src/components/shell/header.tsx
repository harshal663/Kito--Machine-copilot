"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveIndicator } from "./live-indicator";
import { ThemeToggle } from "./theme-toggle";
import { ProfileMenu } from "./profile-menu";

interface HeaderProps {
  title?: string | undefined;
  onOpenMobileMenu?: (() => void) | undefined;
}

export function Header({ title = "Dashboard", onOpenMobileMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenMobileMenu}
            className="lg:hidden min-h-[44px] min-w-[44px]"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <LiveIndicator />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
