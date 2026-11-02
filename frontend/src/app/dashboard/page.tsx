"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Plus,
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { StatCard } from "@/components/shell/stat-card";
import { StatusBadge } from "@/components/shell/status-badge";
import { AlertsBarChart } from "@/components/charts/alerts-bar-chart";
import { RmsLineChart } from "@/components/charts/rms-line-chart";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { isAuthenticated, getStoredUser } from "@/lib/auth";
import { formatISTDateTime } from "@/lib/format";
import type { PageMachine, PageEvent, Trend, Machine, EventSummary } from "@/types";

export default function DashboardPage() {
  const router = useRouter();

  // Authentication & Onboarding Guards
  React.useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/sign-in");
      return;
    }

    const user = getStoredUser();
    if (user && user.onboardingCompleted === false) {
      const stepRoutes: Record<number, string> = {
        1: "/onboarding/personal",
        2: "/onboarding/factory",
        3: "/onboarding/machines",
        4: "/onboarding/review",
      };
      router.replace(stepRoutes[user.onboardingStep || 1] || "/onboarding/personal");
    }
  }, [router]);

  // 1. Fetch Machines Fleet
  const { data: machinesData, isLoading: machinesLoading } = useQuery<PageMachine>({
    queryKey: queryKeys.machines.list(),
    queryFn: () => apiClient.get<PageMachine>("/v1/machines?limit=50"),
  });

  const machines: Machine[] = React.useMemo(() => machinesData?.items ?? [], [machinesData]);

  // Selected Machine for Vibration RMS trend
  const [selectedMachineId, setSelectedMachineId] = React.useState<string>("");

  React.useEffect(() => {
    if (machines.length > 0 && (!selectedMachineId || !machines.some((m) => m.id === selectedMachineId))) {
      const first = machines[0];
      if (first) {
        setSelectedMachineId(first.id);
      }
    }
  }, [machines, selectedMachineId]);

  // 2. Fetch Events / Alerts
  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useQuery<PageEvent>({
    queryKey: queryKeys.events.list(),
    queryFn: () => apiClient.get<PageEvent>("/v1/events?limit=50"),
  });

  const events: EventSummary[] = React.useMemo(() => eventsData?.items ?? [], [eventsData]);

  // 3. Fetch RMS Trend for Selected Machine
  const { data: trendData } = useQuery<Trend>({
    queryKey: queryKeys.machines.trend(selectedMachineId),
    queryFn: () => apiClient.get<Trend>(`/v1/machines/${selectedMachineId}/trend`),
    enabled: !!selectedMachineId,
  });

  // KPI figures
  const totalMachines = machines.length;
  const healthyCount = machines.filter((m) => m.status === "HEALTHY").length;
  const criticalAlertsCount = events.filter((e) => e.severity === "HIGH" || e.status === "ANOMALY_DETECTED" || e.status === "CALLING").length;
  const offlineCount = machines.filter((m) => !m.device_online).length;

  // Process 7-day anomaly distribution for bar chart
  const alertsChartData = React.useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const label = d.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
      });
      days[label] = 0;
    }

    events.forEach((ev) => {
      if (ev.created_at) {
        const d = new Date(ev.created_at);
        const label = d.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
        });
        if (days[label] !== undefined) {
          days[label] += 1;
        }
      }
    });

    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [events]);

  const recentAlerts = React.useMemo(() => events.slice(0, 5), [events]);

  if (machinesLoading || eventsLoading) {
    return (
      <AppShell title="Dashboard">
        <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading fleet dashboard">
          <div className="h-10 w-48 bg-slate-200 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 rounded-2xl bg-white border border-slate-200" />
            <div className="h-72 rounded-2xl bg-white border border-slate-200" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Fleet Command Center">
      <section data-route="/dashboard" aria-labelledby="dash-title" data-testid="page-dashboard" className="space-y-6">
        {/* Header */}
        <header className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 id="dash-title" className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Fleet overview
            </h1>
            <p className="page-meta text-xs sm:text-sm text-slate-500 mt-1">
              Updated <time dateTime={new Date().toISOString()}>just now</time> &bull; India Standard Time (IST)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetchEvents()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl shadow-xs transition-colors min-h-[44px] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#ff5733]" />
              <span>Refresh data</span>
            </button>
            <Link
              href="/machines/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#ff5733] hover:bg-[#ff451d] rounded-xl shadow-xs transition-colors min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
              <span>Register Machine</span>
            </Link>
          </div>
        </header>

        {/* Empty State for New Owner */}
        {machines.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff5733]/10 text-[#ff5733]">
              <Cpu className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
              Add your first machine
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              Kito will list mechanical anomalies and telemetry here once an accelerometer sensor reports. Register a machine to begin continuous baseline learning.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/machines/new"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-[#ff5733] hover:bg-[#ff451d] text-white font-semibold text-sm shadow-md shadow-[#ff5733]/25 transition-all min-h-[44px]"
              >
                <Plus className="h-4 w-4" />
                <span>Register a machine</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Grid */}
            <section aria-labelledby="kpi-title">
              <h2 id="kpi-title" className="sr-only">Key figures</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="list">
                <StatCard
                  testId="kpi-total"
                  label="Total assets"
                  value={totalMachines}
                  subtext="Monitored fleet"
                  icon={<Cpu className="h-5 w-5" />}
                  statusVariant="default"
                />
                <StatCard
                  testId="kpi-healthy"
                  label="Healthy"
                  value={healthyCount}
                  subtext={`${healthyCount} nominal`}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  statusVariant="healthy"
                />
                <StatCard
                  testId="kpi-critical"
                  label="Critical alerts"
                  value={criticalAlertsCount}
                  subtext={criticalAlertsCount > 0 ? "Requires inspection" : "No open anomalies"}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  statusVariant={criticalAlertsCount > 0 ? "alert" : "default"}
                />
                <StatCard
                  testId="kpi-offline"
                  label="Offline nodes"
                  value={offlineCount}
                  subtext={offlineCount > 0 ? "Check sensor node power" : "All nodes reporting"}
                  icon={<WifiOff className="h-5 w-5" />}
                  statusVariant={offlineCount > 0 ? "offline" : "default"}
                />
              </div>
            </section>

            {/* Two Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RmsLineChart
                machines={machines}
                selectedMachineId={selectedMachineId}
                onSelectMachine={setSelectedMachineId}
                trendData={trendData?.points ?? []}
              />
              <AlertsBarChart data={alertsChartData} />
            </div>

            {/* Recent Anomaly Alerts Table (Full Width) */}
            <section
              className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs"
              aria-labelledby="recent-title"
            >
              <header className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 id="recent-title" className="text-base font-bold text-slate-900">
                    Recent anomaly alerts
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Last five anomaly alerts, newest first
                  </p>
                </div>
                <Link
                  href="/alerts"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#ff5733] hover:underline min-h-[44px]"
                >
                  All alerts <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </header>

              <div className="table-scroll mt-2">
                {recentAlerts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No alerts recorded yet. Kito will list anomalies here once a sensor reports.
                  </div>
                ) : (
                  <table className="w-full text-left text-sm" data-testid="recent-alerts">
                    <caption className="sr-only">Last five anomaly alerts, newest first</caption>
                    <thead className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th scope="col" className="py-3 pr-4">Time</th>
                        <th scope="col" className="py-3 px-4">Machine</th>
                        <th scope="col" className="py-3 px-4">Severity</th>
                        <th scope="col" className="py-3 px-4">Status</th>
                        <th scope="col" className="py-3 px-4">Reference</th>
                        <th scope="col" className="py-3 pl-4 text-right">
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentAlerts.map((alert) => {
                        const machineName =
                          machines.find((m) => m.id === alert.machine_id)?.name ||
                          `Machine ${alert.machine_id.slice(-6)}`;
                        const refCode = alert.id.slice(0, 8).toUpperCase();

                        return (
                          <tr key={alert.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 pr-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                              <time dateTime={alert.created_at}>
                                {formatISTDateTime(alert.created_at)}
                              </time>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                              {machineName}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`status-badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  alert.severity === "HIGH"
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : alert.severity === "MEDIUM"
                                    ? "bg-orange-50 text-orange-700 border border-orange-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                {alert.severity || "Warning"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <StatusBadge status={alert.status} />
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <code className="px-2 py-1 rounded bg-slate-100 text-xs font-mono font-bold text-slate-800">
                                {refCode}
                              </code>
                            </td>
                            <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                              <Link
                                href={`/events/${alert.id}`}
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#ff5733] hover:underline min-h-[44px] min-w-[44px] justify-end"
                              >
                                <span>Open</span>
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="sr-only"> alert {refCode}</span>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </AppShell>
  );
}
