"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { isAuthenticated } from "@/lib/auth";
import { formatDecimal, formatISTDateTime } from "@/lib/format";
import type { PageEvent, EventSummary, PageMachine } from "@/types";

export default function AlertsPage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState<string>("");

  React.useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/sign-in");
    }
  }, [router]);

  const { data, isLoading, refetch, isFetching } = useQuery<PageEvent>({
    queryKey: queryKeys.events.list(),
    queryFn: () => apiClient.get<PageEvent>("/v1/events?limit=100"),
  });

  const { data: machinesData } = useQuery<PageMachine>({
    queryKey: queryKeys.machines.list(),
    queryFn: () => apiClient.get<PageMachine>("/v1/machines?limit=100"),
  });

  const machines = React.useMemo(() => machinesData?.items ?? [], [machinesData]);
  const allEvents: EventSummary[] = React.useMemo(() => data?.items ?? [], [data]);

  const filteredEvents = React.useMemo(() => {
    return allEvents.filter((ev) => {
      if (filter !== "ALL" && ev.status !== filter) return false;
      if (search) {
        const machine = machines.find((m) => m.id === ev.machine_id);
        const name = machine?.name.toLowerCase() ?? "";
        const id = ev.id.toLowerCase();
        const s = search.toLowerCase();
        if (!name.includes(s) && !id.includes(s)) return false;
      }
      return true;
    });
  }, [allEvents, filter, search, machines]);

  return (
    <AppShell title="Anomaly Alerts">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Vibration Anomaly Alerts
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Live audit trail of statistical outliers, autonomous voice escalations, and technician intervention logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="gap-2 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-[#ff5733]" : ""}`} />
              Sync Alerts
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by incident reference or machine..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-[#f7f7f8] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff5733]/20 focus:border-[#ff5733]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: "ALL", label: "All Incidents" },
              { id: "ANOMALY_DETECTED", label: "Detected" },
              { id: "CALLING", label: "Dispatching Call" },
              { id: "ACKNOWLEDGED", label: "Acknowledged" },
              { id: "INSPECTION_SCHEDULED", label: "Inspection" },
              { id: "SHUTDOWN_REQUESTED", label: "Shutdown" },
              { id: "ESCALATED", label: "Escalated" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  filter === tab.id
                    ? "bg-[#ff5733] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts Feed */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="font-display text-base font-bold text-slate-900">
              Recorded Incidents ({filteredEvents.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="py-20 text-center text-sm font-medium text-slate-500 animate-pulse">
              Loading anomaly audit stream...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="font-semibold text-slate-800">No anomaly events match this filter</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No telemetry outliers found. Machines are currently operating within nominal baseline parameters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredEvents.map((alert) => {
                const machine = machines.find((m) => m.id === alert.machine_id);
                const machineName = machine?.name || `Machine ${alert.machine_id.slice(-6)}`;

                return (
                  <Link
                    key={alert.id}
                    href={`/events/${alert.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-4 px-2 hover:bg-[#f7f7f8] rounded-xl transition-all gap-4 group"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#ff5733] ring-1 ring-[#ff5733]/20">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-sm text-slate-900 group-hover:text-[#ff5733] transition-colors">
                            {machineName}
                          </p>
                          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                            #{alert.id.slice(0, 8).toUpperCase()}
                          </span>
                          {alert.severity && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                alert.severity === "HIGH"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : alert.severity === "MEDIUM"
                                  ? "bg-orange-50 text-orange-700 border border-orange-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {alert.severity}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>
                            RMS:{" "}
                            <strong data-metric className="font-semibold text-slate-800 tabular-nums">
                              {formatDecimal(alert.rms_g, 3)} g
                            </strong>
                          </span>
                          <span>&bull;</span>
                          <span>
                            Z-Score:{" "}
                            <strong data-metric className="font-semibold text-[#ff5733] tabular-nums">
                              +{formatDecimal(alert.z_score, 1)}σ
                            </strong>
                          </span>
                          <span>&bull;</span>
                          <time dateTime={alert.created_at} className="text-slate-400">
                            {formatISTDateTime(alert.created_at)}
                          </time>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-13 sm:pl-0">
                      <StatusBadge status={alert.status} />
                      <div className="flex items-center text-xs font-semibold text-[#ff5733] opacity-80 group-hover:opacity-100 transition-opacity">
                        Review
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
