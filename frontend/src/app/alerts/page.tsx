"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { isAuthenticated } from "@/lib/auth";
import { formatISTDateTime } from "@/lib/format";
import type { PageEvent, EventSummary } from "@/types";

export default function AlertsPage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<string>("ALL");

  React.useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/sign-in");
    }
  }, [router]);

  const { data, isLoading, refetch, isFetching } = useQuery<PageEvent>({
    queryKey: queryKeys.events.list(),
    queryFn: () => apiClient.get<PageEvent>("/v1/events?limit=100"),
  });

  const allEvents: EventSummary[] = React.useMemo(() => data?.items ?? [], [data]);

  const filteredEvents = React.useMemo(() => {
    if (filter === "ALL") return allEvents;
    return allEvents.filter((e) => e.status === filter);
  }, [allEvents, filter]);

  return (
    <AppShell title="Anomaly Alerts">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Vibration Anomaly Alerts
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live audit trail of mechanical anomalies, automated voice dispatch, and technician
              decisions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="text-xs min-h-[44px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {["ALL", "TRIGGERED", "CALLING", "ACKNOWLEDGED", "RESOLVED", "FALSE_ALARM"].map(
            (statusKey) => (
              <Button
                key={statusKey}
                variant={filter === statusKey ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(statusKey)}
                className="text-xs min-h-[44px] rounded-full"
              >
                {statusKey === "ALL" ? "All Alerts" : statusKey.replace("_", " ")}
              </Button>
            )
          )}
        </div>

        {/* Alerts List */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Recorded Events ({filteredEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
                Loading anomaly records...
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No events found matching the selected filter.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredEvents.map((alert) => (
                  <Link
                    key={alert.id}
                    href={`/events/${alert.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 px-2 hover:bg-muted/40 transition-colors rounded-lg gap-3 min-h-[44px]"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 mt-0.5 sm:mt-0">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground">
                            Machine {alert.machine_id.slice(-6)}
                          </p>
                          <span className="text-xs font-mono text-muted-foreground">
                            ID: {alert.id.slice(0, 12)}...
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Detected: {formatISTDateTime(alert.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
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
    </AppShell>
  );
}
