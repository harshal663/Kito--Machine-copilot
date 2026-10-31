"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiClient } from "@/lib/api-client";
import { isAuthenticated } from "@/lib/auth";
import type { PageMachine } from "@/types";
import { AppShell } from "@/components/shell/app-shell";
import { MachineCard } from "@/components/machines/machine-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function MachinesPage() {
  const router = useRouter();

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
  } = useQuery<PageMachine>({
    queryKey: queryKeys.machines.list(),
    queryFn: () => apiClient.get<PageMachine>("/v1/machines?limit=50"),
  });

  const machines = pageData?.items ?? [];
  const totalAlerts = machines.reduce((acc, m) => acc + (m.open_alerts || 0), 0);
  const onlineNodes = machines.filter((m) => m.device_online).length;

  return (
    <AppShell title="Machinery Fleet">
      <div className="space-y-6">
      {/* Top Header & Overview Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Industrial Assets & Machinery
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time mechanical vibration telemetry and automated AI voice alerts.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="text-xs min-h-[44px]"
          >
            ↻ Refresh
          </Button>
          <Link href="/machines/new">
            <Button size="sm" className="font-semibold text-xs min-h-[44px]">
              + Register Machine
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Monitored Assets
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {machines.length}
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Active Anomaly Alerts
          </span>
          <span
            className={`text-2xl font-bold mt-1 block ${
              totalAlerts > 0 ? "text-red-600 animate-pulse" : "text-emerald-600"
            }`}
          >
            {totalAlerts}
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Sensor Nodes Online
          </span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">
            {onlineNodes} / {machines.length}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading asset telemetry...</p>
        </div>
      ) : isError ? (
        <Alert variant="danger">
          <AlertTitle>Failed to load machines</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "An unexpected network error occurred."}
          </AlertDescription>
        </Alert>
      ) : machines.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-lg border border-dashed border-slate-300 p-8 space-y-3">
          <div className="text-4xl">⚙️</div>
          <h3 className="text-lg font-semibold text-slate-900">No machinery registered yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Get started by registering an industrial asset and binding an ESP32 accelerometer sensor
            node to monitor live vibration.
          </p>
          <div className="pt-2">
            <Link href="/machines/new">
              <Button className="min-h-[44px]">+ Register First Machine</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((machine) => (
            <MachineCard key={machine.id} machine={machine} />
          ))}
        </div>
      )}
    </div>
    </AppShell>
  );
}
