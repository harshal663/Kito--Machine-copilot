"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearStoredToken, getStoredUser, type StoredUser } from "@/lib/auth";
import { useLiveUpdates } from "@/lib/live-updates";
import { Button } from "@/components/ui/button";

export function Header() {
  const router = useRouter();
  const { connectionState } = useLiveUpdates();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const handleLogout = () => {
    clearStoredToken();
    router.push("/login");
  };

  const statusIndicator = {
    OPEN: { color: "bg-emerald-500", text: "Live", title: "Connected to real-time events" },
    CONNECTING: { color: "bg-blue-500 animate-pulse", text: "Connecting", title: "Establishing live updates stream" },
    RECONNECTING: { color: "bg-amber-500 animate-pulse", text: "Reconnecting", title: "Reconnecting to live updates stream" },
    CLOSED: { color: "bg-slate-400", text: "Offline", title: "Live updates stream disconnected" },
  }[connectionState];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center space-x-6">
          <Link href="/machines" className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight text-slate-900">
              ⚙️ Machine Copilot
            </span>
          </Link>
          <nav className="hidden md:flex space-x-4">
            <Link
              href="/machines"
              className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
            >
              Machines
            </Link>
            <Link
              href="/machines/new"
              className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
            >
              + Register Machine
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full border border-slate-200 text-xs font-medium text-slate-600 bg-slate-50"
            title={statusIndicator.title}
          >
            <span className={`h-2 w-2 rounded-full ${statusIndicator.color}`} />
            <span>{statusIndicator.text}</span>
          </div>

          {user && (
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-medium text-slate-900">{user.email}</span>
            </div>
          )}

          {user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs min-h-[44px]"
            >
              Sign out
            </Button>
          ) : (
            <Link href="/login">
              <Button size="sm" className="text-xs min-h-[44px]">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
