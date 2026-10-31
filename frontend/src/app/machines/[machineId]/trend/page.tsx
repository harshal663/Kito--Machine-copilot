"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiClient } from "@/lib/api-client";
import type { Trend, Machine } from "@/types";
import { AppShell } from "@/components/shell/app-shell";
import { TrendChart } from "@/components/charts/trend-chart";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDecimal } from "@/lib/format";

export default function MachineTrendPage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  const resolvedParams = use(params);
  const machineId = resolvedParams.machineId;

  const [hours, setHours] = useState<number>(24);

  const { data: machine } = useQuery<Machine>({
    queryKey: queryKeys.machines.detail(machineId),
    queryFn: () => apiClient.get<Machine>(`/v1/machines/${machineId}`),
  });

  const {
    data: trendData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Trend>({
    queryKey: queryKeys.machines.trend(machineId, hours),
    queryFn: () => apiClient.get<Trend>(`/v1/machines/${machineId}/trend?hours=${hours}`),
  });

  return (
    <AppShell title="Vibration Trend">
      <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-sm text-slate-500">
        <Link href="/machines" className="hover:text-blue-600 transition-colors">
          Machines
        </Link>
        <span>/</span>
        <Link href={`/machines/${machineId}`} className="hover:text-blue-600 transition-colors">
          {machine?.name ?? "Machine"}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Vibration Trend</span>
      </div>

      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Vibration RMS Trend ({hours}h Window)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Historical acceleration root-mean-square (RMS) recorded by sensor node.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {[6, 12, 24, 48].map((h) => (
            <Button
              key={h}
              variant={hours === h ? "primary" : "outline"}
              size="sm"
              onClick={() => setHours(h)}
              className="text-xs min-h-[44px]"
            >
              {h}h
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refetch()}
            className="text-xs min-h-[44px]"
          >
            ↻
          </Button>
        </div>
      </div>

      {/* KPI Highlights */}
      {trendData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Samples In Window</span>
            <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
              {(trendData.points ?? []).length}
            </span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Average RMS (g)</span>
            <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
              {formatDecimal(
                (trendData.points ?? []).length > 0
                  ? (trendData.points ?? []).reduce((acc, p) => acc + p.rms_g, 0) /
                      (trendData.points ?? []).length
                  : 0,
                3
              )}{" "}
              g
            </span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Peak Vibration (g)</span>
            <span className="text-lg font-bold font-mono text-red-600 mt-0.5 block">
              {formatDecimal(
                (trendData.points ?? []).length > 0
                  ? Math.max(...(trendData.points ?? []).map((p) => p.rms_g))
                  : 0,
                3
              )}{" "}
              g
            </span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Time Span</span>
            <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
              Last {hours} Hours
            </span>
          </div>
        </div>
      )}

      {/* Trend Line Chart */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white rounded-lg border border-slate-200">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Querying vibration time-series points...</p>
        </div>
      ) : isError ? (
        <Alert variant="danger">
          <AlertTitle>Trend Query Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Failed to load trend points"}
          </AlertDescription>
        </Alert>
      ) : (
        <TrendChart
          points={trendData?.points ?? []}
        />
      )}
    </div>
    </AppShell>
  );
}
