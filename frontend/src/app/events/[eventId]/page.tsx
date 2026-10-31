"use client";

import React, { use } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiClient } from "@/lib/api-client";
import type { EventDetail } from "@/types";
import { AppShell } from "@/components/shell/app-shell";
import { DiagnosisCard } from "@/components/alerts/diagnosis-card";
import { DecisionButtons } from "@/components/alerts/decision-buttons";
import { EvidencePanel } from "@/components/alerts/evidence-panel";
import { CallHistory } from "@/components/alerts/call-history";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatISTDateTime } from "@/lib/format";

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;
  const queryClient = useQueryClient();

  const {
    data: event,
    isLoading,
    isError,
    error,
  } = useQuery<EventDetail>({
    queryKey: queryKeys.events.detail(eventId),
    queryFn: () => apiClient.get<EventDetail>(`/v1/events/${eventId}`),
  });

  if (isLoading) {
    return (
      <AppShell title="Incident Detail">
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground">Loading anomaly event details...</p>
        </div>
      </AppShell>
    );
  }

  if (isError || !event) {
    return (
      <AppShell title="Incident Detail">
        <div className="space-y-4">
          <Link href="/alerts" className="text-sm text-primary hover:underline">
            ← Back to Alerts
          </Link>
          <Alert variant="danger">
            <AlertTitle>Event Not Found</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Anomaly incident does not exist."}
            </AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  const handleDecisionRecorded = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(eventId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.machines.all });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACKNOWLEDGED":
      case "INSPECTION_SCHEDULED":
        return "success";
      case "SHUTDOWN_REQUESTED":
      case "ESCALATED":
      case "FAILED":
        return "danger";
      case "CALLING":
      case "RETRYING":
      case "DIAGNOSING":
      case "ANOMALY_DETECTED":
        return "warning";
      default:
        return "secondary";
    }
  };

  return (
    <AppShell title="Incident Detail">
      <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-slate-500">
        <Link href="/machines" className="hover:text-blue-600 transition-colors">
          Machines
        </Link>
        <span>/</span>
        <Link
          href={`/machines/${event.machine_id}`}
          className="hover:text-blue-600 transition-colors"
        >
          Machine {event.machine_id.slice(-6)}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Incident {event.id.slice(-6)}</span>
      </div>

      {/* Incident Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Vibration Anomaly Event
              </h1>
              <Badge variant={getStatusBadgeVariant(event.status)} className="font-mono text-xs">
                {event.status}
              </Badge>
            </div>
            <p className="text-xs font-mono text-slate-500">
              Event ID: {event.id} &bull; Machine: {event.machine_id}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block">Detected (IST)</span>
            <span className="text-sm font-semibold text-slate-800">
              {formatISTDateTime(event.ts)}
            </span>
          </div>
        </div>
      </div>

      {/* Operator Decision Action Block */}
      <DecisionButtons
        eventId={event.id}
        status={event.status}
        decision={event.decision}
        decidedAt={event.decided_at}
        onDecisionSubmitted={handleDecisionRecorded}
      />

      {/* Diagnostic Assessment Card (with Rule-based badge if fallback) */}
      <DiagnosisCard
        diagnosis={event.diagnosis}
        diagnosisSource={event.diagnosis_source}
      />

      {/* Sensor Evidence & FFT Spectrum */}
      <EvidencePanel
        rmsG={event.rms_g}
        zScore={event.z_score}
        baseline={event.baseline}
        peaks={event.peaks}
        hints={event.hints}
      />

      {/* Voice Call History & Escalation Logs */}
      <CallHistory attempts={event.call_attempts} />
    </div>
    </AppShell>
  );
}
