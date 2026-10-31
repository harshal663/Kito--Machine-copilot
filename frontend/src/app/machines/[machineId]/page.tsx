"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiClient } from "@/lib/api-client";
import type { Machine, PageEvent, TestCallAccepted, Manual } from "@/types";
import { AppShell } from "@/components/shell/app-shell";
import { EventRow } from "@/components/alerts/event-row";
import { DeviceBindingModal } from "@/components/machines/device-binding-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatISTDateTime, maskPhone } from "@/lib/format";

export default function MachineDetailPage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  const resolvedParams = use(params);
  const machineId = resolvedParams.machineId;
  const queryClient = useQueryClient();

  const [isBindingOpen, setIsBindingOpen] = useState(false);
  const [testCallStatus, setTestCallStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch machine details
  const {
    data: machine,
    isLoading: machineLoading,
    error: machineError,
  } = useQuery<Machine>({
    queryKey: queryKeys.machines.detail(machineId),
    queryFn: () => apiClient.get<Machine>(`/v1/machines/${machineId}`),
  });

  // Fetch events list for machine
  const {
    data: eventsPage,
    isLoading: eventsLoading,
  } = useQuery<PageEvent>({
    queryKey: queryKeys.events.listByMachine(machineId),
    queryFn: () => apiClient.get<PageEvent>(`/v1/machines/${machineId}/events?limit=30`),
  });

  // Trigger test AI voice call
  const testCallMutation = useMutation({
    mutationFn: () =>
      apiClient.post<TestCallAccepted>(`/v1/machines/${machineId}/test-call`),
    onSuccess: (data) => {
      setTestCallStatus(
        `✓ Test call successfully initiated for machine ${data.machine_id}. Expecting mock or phone dispatch.`
      );
      setTimeout(() => setTestCallStatus(null), 8000);
    },
    onError: (err: unknown) => {
      setTestCallStatus(
        `❌ ${err instanceof Error ? err.message : "Failed to initiate test call"}`
      );
    },
  });

  // Upload manual PDF
  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Please select a valid PDF file.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError("PDF manual must not exceed 20MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await apiClient.upload<Manual>(`/v1/machines/${machineId}/manuals`, formData);
      void queryClient.invalidateQueries({ queryKey: queryKeys.manuals.byMachine(machineId) });
      alert("Manual uploaded successfully and enqueued for RAG embedding!");
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload manual");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  if (machineLoading) {
    return (
      <AppShell title="Asset Telemetry">
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground">Loading machine details...</p>
        </div>
      </AppShell>
    );
  }

  if (machineError || !machine) {
    return (
      <AppShell title="Asset Telemetry">
        <div className="space-y-4">
          <Link href="/machines" className="text-sm text-primary hover:underline">
            ← Back to Machines
          </Link>
          <Alert variant="danger">
            <AlertTitle>Asset Not Found</AlertTitle>
            <AlertDescription>
              {machineError instanceof Error ? machineError.message : "Machine does not exist."}
            </AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  const isOnline = machine.device_online;
  const events = eventsPage?.items ?? [];

  return (
    <AppShell title={machine.name}>
      <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center space-x-2 text-sm text-slate-500">
        <Link href="/machines" className="hover:text-blue-600 transition-colors">
          Machines
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{machine.name}</span>
      </div>

      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{machine.name}</h1>
            <Badge variant={isOnline ? "success" : "secondary"}>
              {isOnline ? "● Sensor Online" : "○ Sensor Offline"}
            </Badge>
          </div>
          <p className="text-xs font-mono text-slate-500">
            ID: {machine.id} &bull; Type: {machine.machine_type} {machine.model ? `(${machine.model})` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/machines/${machine.id}/trend`}>
            <Button variant="outline" size="sm" className="min-h-[44px]">
              📊 Trend Analysis
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBindingOpen(true)}
            className="min-h-[44px]"
          >
            🔑 Bind Sensor Node
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => testCallMutation.mutate()}
            isLoading={testCallMutation.isPending}
            className="min-h-[44px]"
          >
            📞 Test Voice Call
          </Button>
        </div>
      </div>

      {/* Feedback alerts */}
      {testCallStatus && (
        <Alert variant={testCallStatus.startsWith("✓") ? "success" : "danger"}>
          <AlertDescription>{testCallStatus}</AlertDescription>
        </Alert>
      )}

      {uploadError && (
        <Alert variant="danger">
          <AlertTitle>Manual Upload Failed</AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      {/* Technical Parameters & Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Machine Specifications
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-400">Rated Operating RPM</dt>
              <dd className="font-semibold text-slate-800 text-sm mt-0.5">
                {machine.rated_rpm ? `${machine.rated_rpm} RPM` : "Unspecified"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Health Status</dt>
              <dd className="font-semibold text-slate-800 text-sm mt-0.5 font-mono">
                {machine.status}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Language</dt>
              <dd className="font-mono text-slate-800 text-xs mt-0.5">
                {machine.language}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Last Telemetry Heartbeat</dt>
              <dd className="font-medium text-slate-800 mt-0.5">
                {formatISTDateTime(machine.last_seen_at)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Emergency Voice & Contacts
            </h3>
          </div>
          <dl className="grid grid-cols-1 gap-2 text-xs">
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <dt className="text-slate-500 font-medium">Supervisor Contact (AI Voice Call)</dt>
              <dd className="text-slate-900 font-semibold text-sm mt-0.5">
                {machine.supervisor_name ?? "Lead"} &bull; {maskPhone(machine.supervisor_phone)}
              </dd>
            </div>
            {machine.backup_phone && (
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <dt className="text-slate-500 font-medium">Backup Escalation (SMS Notification)</dt>
                <dd className="text-slate-900 font-semibold text-sm mt-0.5">
                  {maskPhone(machine.backup_phone)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Manual Upload Section */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Equipment Operating Manual (RAG Knowledge)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload PDF operating manuals. Chunks are embedded with pgvector to ground AI diagnostic causes.
            </p>
          </div>
          <div>
            <label className="inline-flex items-center justify-center font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs px-4 py-2 cursor-pointer min-h-[44px]">
              {isUploading ? "Uploading & Chunking..." : "📄 Upload PDF Manual"}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleManualUpload}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Anomaly Alerts List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Vibration Anomaly Incidents</h2>
          <span className="text-xs text-slate-500">{events.length} Incident(s)</span>
        </div>

        {eventsLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading anomaly events...</div>
        ) : events.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-dashed border-slate-300 text-center text-sm text-slate-500">
            No anomaly events detected for this machine. Vibration levels are within baseline limits.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => (
              <EventRow key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>

      {/* Sensor Node Binding Dialog */}
      <DeviceBindingModal
        isOpen={isBindingOpen}
        onClose={() => setIsBindingOpen(false)}
        machineId={machine.id}
        machineName={machine.name}
        onDeviceBound={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.machines.detail(machineId) });
        }}
      />
    </div>
    </AppShell>
  );
}
