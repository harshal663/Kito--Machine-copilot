"use client";

import Link from "next/link";
import { LogOut, Settings as SettingsIcon, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { signOut, getStoredUser } from "@/lib/auth";
import type { User, Factory } from "@/types";

export function ProfileMenu() {
  const localUser = getStoredUser();

  const { data: user } = useQuery<User>({
    queryKey: queryKeys.user.me(),
    queryFn: () => apiClient.get<User>("/v1/me"),
    staleTime: 60_000,
  });

  const { data: factory } = useQuery<Factory | null>({
    queryKey: queryKeys.factory.mine(),
    queryFn: async () => {
      try {
        return await apiClient.get<Factory>("/v1/factory");
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const displayName = user?.full_name || localUser?.fullName || "Factory Owner";
  const displayEmail = user?.email || localUser?.email || "owner@example.com";
  const factoryName = factory?.name || "My Factory";

  return (
    <DropdownMenu
      align="right"
      trigger={
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-1 ring-offset-background transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[44px] min-w-[44px]"
          aria-label="Open user menu"
        >
          <Avatar name={displayName} />
        </button>
      }
    >
      <div className="px-3 py-2 text-left border-b border-border">
        <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{factoryName}</span>
        </div>
      </div>

      <div className="p-1">
        <Link href="/factory" className="w-full">
          <DropdownMenuItem>
            <Building2 className="mr-2 h-4 w-4" />
            <span>Factory Details</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/settings" className="w-full">
          <DropdownMenuItem>
            <SettingsIcon className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </Link>
      </div>

      <DropdownMenuSeparator />

      <div className="p-1">
        <DropdownMenuItem destructive onClick={() => signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </div>
    </DropdownMenu>
  );
}

