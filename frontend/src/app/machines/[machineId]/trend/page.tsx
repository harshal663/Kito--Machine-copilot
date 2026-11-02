"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, RefreshCw } from "lucide-react";
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
    isFetching,
  } = useQuery<Trend>({
    queryKey: queryKeys.machines.trend(machineId, hours),
    queryFn: () => apiClient.get<Trend>(`/v1/machines/${machineId}/trend?hours=${hours}`),
  });

  const points = trendData?.points ?? [];
  const avgRms =
    points.length > 0
      ? points.reduce((acc, p) => acc + p.rms_g, 0) / points.length
      : 0;
  const peakRms =
    points.length > 0
      ? Math.max(...points.map((p) => p.rms_g))
      : 0;

  return (
    <AppShell title="Vibration Trend">
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/machines" className="hover:text-[#ff5733] transition-colors">
            Machines
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <Link href={`/machines/${machineId}`} className="hover:text-[#ff5733] transition-colors">
            {machine?.name ?? "Machine"}
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-semibold text-slate-800">Vibration Trend</span>
        </div>

        {/* Header and Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Vibration Trend ({hours}h Window)
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Acceleration root-mean-square (RMS) telemetry sampled continuously by edge sensor.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[6, 12, 24, 48].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(h)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  hours === h
                    ? "bg-[#ff5733] text-white shadow-sm"
                    : "bg-[#f7f7f8] text-slate-600 hover:bg-slate-200/60"
                }`}
              >
                {h}h
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="gap-1 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-[#ff5733]" : ""}`} />
            </Button>
          </div>
        </div>

        {/* 4 Stat KPI Highlights */}
        {trendData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Window Samples
              </span>
              <span data-metric className="font-display text-2xl font-bold text-slate-900 mt-2 block tabular-nums">
                {points.length}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Average RMS
              </span>
              <span data-metric className="font-display text-2xl font-bold text-slate-900 mt-2 block tabular-nums">
                {formatDecimal(avgRms, 3)}{" "}
                <span className="text-xs font-normal text-slate-500">g</span>
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Peak Vibration
              </span>
              <span
                data-metric
                className={`font-display text-2xl font-bold mt-2 block tabular-nums ${
                  peakRms > 1.0 ? "text-rose-600" : "text-slate-900"
                }`}
              >
                {formatDecimal(peakRms, 3)}{" "}
                <span className="text-xs font-normal text-slate-500">g</span>
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                Time Window
              </span>
              <span data-metric className="font-display text-2xl font-bold text-slate-900 mt-2 block tabular-nums">
                Last {hours}h
              </span>
            </div>
          </div>
        )}

        {/* Trend Line Chart */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
            <Spinner size="lg" className="text-[#ff5733]" />
            <p className="text-sm font-medium text-slate-500">Querying vibration time-series points...</p>
          </div>
        ) : isError ? (
          <Alert variant="danger" className="rounded-2xl">
            <AlertTitle>Trend Query Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Failed to load trend points"}
            </AlertDescription>
          </Alert>
        ) : (
          <TrendChart points={points} />
        )}
      </div>
    </AppShell>
  );
}
