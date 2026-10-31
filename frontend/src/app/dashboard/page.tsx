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
  Wifi,
  ExternalLink,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { StatCard } from "@/components/shell/stat-card";
import { StatusBadge } from "@/components/shell/status-badge";
import { AlertsBarChart } from "@/components/charts/alerts-bar-chart";
import { RmsLineChart } from "@/components/charts/rms-line-chart";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  const { data: eventsData, isLoading: eventsLoading } = useQuery<PageEvent>({
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

  // Calculate Summary KPIs (Strictly 4 cards per design spec)
  const totalMachines = machines.length;
  const healthyCount = machines.filter((m) => m.status === "HEALTHY").length;
  const openAlertsCount = machines.reduce((acc, m) => acc + (m.open_alerts || 0), 0);
  const offlineCount = machines.filter((m) => !m.device_online).length;

  // Process 14-day alert distribution for bar chart
  const alertsChartData = React.useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();

    // Initialize last 14 days with 0 in IST
    for (let i = 13; i >= 0; i--) {
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
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-card border border-border" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 rounded-xl bg-card border border-border" />
            <div className="h-72 rounded-xl bg-card border border-border" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard">
      {/* Empty State for New Owner */}
      {machines.length === 0 ? (
        <Card className="border-dashed border-2 border-border p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Cpu className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-bold tracking-tight text-foreground">
            No machinery registered yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Get started by registering an industrial asset and binding an ESP32 accelerometer sensor
            node to monitor continuous mechanical vibration and receive automated AI voice alerts.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/machines/new">
              <Button className="min-h-[44px] px-6 text-sm font-semibold">
                <Plus className="h-4 w-4 mr-2" />
                Register First Machine
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Four Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Machines"
              value={totalMachines}
              subtext="Total fleet monitored"
              icon={<Cpu className="h-5 w-5" />}
              statusVariant="default"
            />
            <StatCard
              label="Healthy"
              value={healthyCount}
              subtext={`${healthyCount} of ${totalMachines} nominal`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              statusVariant="healthy"
            />
            <StatCard
              label="Open alerts"
              value={openAlertsCount}
              subtext={openAlertsCount > 0 ? "Requires shop-floor inspection" : "No open anomalies"}
              icon={<AlertTriangle className="h-5 w-5" />}
              statusVariant={openAlertsCount > 0 ? "alert" : "default"}
            />
            <StatCard
              label="Devices offline"
              value={offlineCount}
              subtext={offlineCount > 0 ? "Check sensor node power" : "All nodes reporting"}
              icon={<WifiOff className="h-5 w-5" />}
              statusVariant={offlineCount > 0 ? "offline" : "default"}
            />
          </div>

          {/* Two Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AlertsBarChart data={alertsChartData} />
            <RmsLineChart
              machines={machines}
              selectedMachineId={selectedMachineId}
              onSelectMachine={setSelectedMachineId}
              trendData={trendData?.points ?? []}
            />
          </div>

          {/* Machine Fleet List */}
          <Card className="border-border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Machinery Fleet Status</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Live presence and status across all registered assets
                </p>
              </div>
              <Link href="/machines">
                <Button variant="ghost" size="sm" className="text-xs min-h-[44px]">
                  View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-3 pr-4">Machine</th>
                      <th className="pb-3 px-4">Status</th>
                      <th className="pb-3 px-4">Device Node</th>
                      <th className="pb-3 px-4">Last Check-in (IST)</th>
                      <th className="pb-3 pl-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {machines.map((machine) => (
                      <tr key={machine.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 pr-4 font-medium text-foreground">
                          <div>
                            <span>{machine.name}</span>
                            <span className="block text-xs font-normal text-muted-foreground capitalize">
                              {machine.machine_type} &bull; {machine.rated_rpm || 1450} RPM
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={machine.status} />
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                              machine.device_online
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {machine.device_online ? (
                              <Wifi className="h-3.5 w-3.5" />
                            ) : (
                              <WifiOff className="h-3.5 w-3.5" />
                            )}
                            {machine.device_online ? "Online" : "Offline"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {formatISTDateTime(machine.last_seen_at)}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <Link href={`/machines/${machine.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs min-h-[44px] min-w-[44px]"
                              aria-label={`View details for ${machine.name}`}
                            >
                              Details
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Recent Alerts List (Last 5) */}
          <Card className="border-border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Recent Anomaly Alerts</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Latest 5 anomaly events detected by vibration intelligence
                </p>
              </div>
              <Link href="/alerts">
                <Button variant="ghost" size="sm" className="text-xs min-h-[44px]">
                  All alerts <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentAlerts.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No anomaly alerts recorded. All machinery running within baseline thresholds.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentAlerts.map((alert) => (
                    <Link
                      key={alert.id}
                      href={`/events/${alert.id}`}
                      className="flex items-center justify-between py-3 hover:bg-muted/40 transition-colors rounded-lg px-2 min-h-[44px]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {machines.find((m) => m.id === alert.machine_id)?.name ||
                              `Machine ${alert.machine_id.slice(-6)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            RMS: {alert.rms_g.toFixed(2)}g &bull; Triggered:{" "}
                            {formatISTDateTime(alert.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={alert.status} />
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
