"use client";

import React, { use } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Calendar, ChevronRight } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import { apiClient } from "@/lib/api-client";
import type { EventDetail } from "@/types";
import { AppShell } from "@/components/shell/app-shell";
import { DiagnosisCard } from "@/components/alerts/diagnosis-card";
import { DecisionButtons } from "@/components/alerts/decision-buttons";
import { EvidencePanel } from "@/components/alerts/evidence-panel";
import { CallHistory } from "@/components/alerts/call-history";
import { StatusBadge } from "@/components/shell/status-badge";
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
          <Spinner size="lg" className="text-[#ff5733]" />
          <p className="text-sm font-medium text-slate-500">Loading anomaly event details...</p>
        </div>
      </AppShell>
    );
  }

  if (isError || !event) {
    return (
      <AppShell title="Incident Detail">
        <div className="space-y-4 max-w-xl mx-auto py-8">
          <Link
            href="/alerts"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#ff5733]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Alerts
          </Link>
          <Alert variant="danger" className="rounded-2xl">
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

  return (
    <AppShell title="Incident Detail">
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/machines" className="hover:text-[#ff5733] transition-colors">
            Machines
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <Link
            href={`/machines/${event.machine_id}`}
            className="hover:text-[#ff5733] transition-colors"
          >
            Machine {event.machine_id.slice(-6)}
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-semibold text-slate-800">
            Incident #{event.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        {/* Incident Header Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#ff5733] ring-1 ring-[#ff5733]/20">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                    Vibration Anomaly Event
                  </h1>
                  <p className="text-xs font-mono text-slate-500">
                    Event ID: {event.id} &bull; Machine: {event.machine_id}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1">
              <StatusBadge status={event.status} />
              <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                <span>Detected: {formatISTDateTime(event.ts)}</span>
              </div>
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

        {/* Diagnostic Assessment Card */}
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
