"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Sheet } from "@/components/ui/sheet";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AppShell({ children, title }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
        />
      </div>

      {/* Mobile drawer sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="left">
        <Sidebar onNavigate={() => setMobileOpen(false)} className="border-r-0" />
      </Sheet>

      {/* Main content body */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <Header title={title} onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1200px] space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

