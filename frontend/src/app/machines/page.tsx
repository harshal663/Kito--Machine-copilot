"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  Server,
  Cpu,
} from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import { apiClient } from "@/lib/api-client";
import { isAuthenticated } from "@/lib/auth";
import type { PageMachine, Machine } from "@/types";
import { AppShell } from "@/components/shell/app-shell";
import { MachineCard } from "@/components/machines/machine-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function MachinesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "HEALTHY" | "LEARNING" | "ALERT" | "OFFLINE">("ALL");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/sign-in");
    }
  }, [router]);

  const {
    data: pageData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<PageMachine>({
    queryKey: queryKeys.machines.list(),
    queryFn: () => apiClient.get<PageMachine>("/v1/machines?limit=50"),
  });

  const machines: Machine[] = useMemo(() => pageData?.items ?? [], [pageData]);
  const totalAlerts = machines.reduce((acc, m) => acc + (m.open_alerts || 0), 0);
  const onlineNodes = machines.filter((m) => m.device_online).length;

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.machine_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.model && m.model.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === "ALL") return true;
      if (statusFilter === "OFFLINE") return !m.device_online;
      return m.status === statusFilter;
    });
  }, [machines, searchQuery, statusFilter]);

  return (
    <AppShell title="Machinery Fleet">
      <div className="space-y-6">
        {/* Top Header & Fleet Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Machinery Fleet
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Real-time mechanical vibration telemetry, edge sensor nodes, and proactive AI diagnosis.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="gap-2 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-[#ff5733]" : ""}`} />
              Sync Fleet
            </Button>
            <Link href="/machines/new">
              <Button
                size="sm"
                className="gap-2 text-xs font-semibold bg-[#ff5733] hover:bg-[#e04522] text-white shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Register Machine
              </Button>
            </Link>
          </div>
        </div>

        {/* 3 Fleet KPI Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Monitored Assets
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-[#ff5733]">
                <Cpu className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span data-metric className="font-display text-3xl font-bold text-slate-900 tabular-nums">
                {machines.length}
              </span>
              <span className="text-xs text-slate-500">total units</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Active Anomaly Alerts
              </span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  totalAlerts > 0 ? "bg-rose-50 text-rose-600 animate-pulse" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                data-metric
                className={`font-display text-3xl font-bold tabular-nums ${
                  totalAlerts > 0 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {totalAlerts}
              </span>
              <span className="text-xs text-slate-500">
                {totalAlerts === 1 ? "flagged issue" : "flagged issues"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Live Sensor Nodes
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Server className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span data-metric className="font-display text-3xl font-bold text-slate-900 tabular-nums">
                {onlineNodes}
              </span>
              <span className="text-xs text-slate-500">
                of {machines.length} transmitting
              </span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by machine name, type, or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-[#f7f7f8] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff5733]/20 focus:border-[#ff5733]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {(["ALL", "HEALTHY", "LEARNING", "ALERT", "OFFLINE"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === status
                    ? "bg-[#ff5733] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Spinner size="lg" className="text-[#ff5733]" />
            <p className="text-sm font-medium text-slate-500">Connecting to machine telemetry stream...</p>
          </div>
        ) : isError ? (
          <Alert variant="danger" className="rounded-2xl">
            <AlertTitle>Failed to load machines</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "An unexpected network error occurred."}
            </AlertDescription>
          </Alert>
        ) : filteredMachines.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5733] ring-1 ring-[#ff5733]/20">
              <Cpu className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                {searchQuery || statusFilter !== "ALL"
                  ? "No machinery matching criteria"
                  : "No machinery registered yet"}
              </h3>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                {searchQuery || statusFilter !== "ALL"
                  ? "Try resetting your search filters to display all assets."
                  : "Register your first industrial asset and bind an ESP32 accelerometer sensor node to initiate vibration monitoring."}
              </p>
            </div>
            <div className="pt-2">
              {searchQuery || statusFilter !== "ALL" ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                  className="text-xs"
                >
                  Clear Filters
                </Button>
              ) : (
                <Link href="/machines/new">
                  <Button className="bg-[#ff5733] hover:bg-[#e04522] text-white shadow-sm text-xs">
                    + Register First Machine
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMachines.map((machine) => (
              <MachineCard key={machine.id} machine={machine} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
