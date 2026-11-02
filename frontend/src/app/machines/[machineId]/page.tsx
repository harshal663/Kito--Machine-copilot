"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  Cpu,
  FileText,
  Key,
  Phone,
  PhoneCall,
  TrendingUp,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import { apiClient } from "@/lib/api-client";
import type { Machine, PageEvent, TestCallAccepted, Manual } from "@/types";
import { AppShell } from "@/components/shell/app-shell";
import { EventRow } from "@/components/alerts/event-row";
import { DeviceBindingModal } from "@/components/machines/device-binding-modal";
import { Button } from "@/components/ui/button";
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
        `✓ Test call successfully initiated for machine ${data.machine_id}. Expecting phone dispatch.`
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
      alert("Manual uploaded successfully and queued for AI knowledge embedding!");
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
          <Spinner size="lg" className="text-[#ff5733]" />
          <p className="text-sm font-medium text-slate-500">Loading machine details...</p>
        </div>
      </AppShell>
    );
  }

  if (machineError || !machine) {
    return (
      <AppShell title="Asset Telemetry">
        <div className="space-y-4 max-w-xl mx-auto py-8">
          <Link
            href="/machines"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#ff5733]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Machines
          </Link>
          <Alert variant="danger" className="rounded-2xl">
            <AlertTitle>Asset Not Found</AlertTitle>
            <AlertDescription>
              {machineError instanceof Error ? machineError.message : "Machine does not exist or has been removed."}
            </AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  const isOnline = Boolean(machine.device_online);
  const events = eventsPage?.items ?? [];

  return (
    <AppShell title={machine.name}>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/machines" className="hover:text-[#ff5733] transition-colors">
            Machines
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-semibold text-slate-800">{machine.name}</span>
        </div>

        {/* Top Banner / Heading */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {machine.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isOnline
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70"
                    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
                {isOnline ? "Sensor Transmitting" : "Sensor Offline"}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-500">
              ID: {machine.id} &bull; Type: {machine.machine_type} {machine.model ? `(${machine.model})` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/machines/${machine.id}/trend`}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                Vibration Trend
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBindingOpen(true)}
              className="gap-1.5 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Key className="h-3.5 w-3.5 text-[#ff5733]" />
              Bind Sensor
            </Button>
            <Button
              size="sm"
              onClick={() => testCallMutation.mutate()}
              isLoading={testCallMutation.isPending}
              className="gap-1.5 text-xs font-semibold bg-[#ff5733] hover:bg-[#e04522] text-white shadow-sm"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Dispatch Test Call
            </Button>
          </div>
        </div>

        {/* Feedback alerts */}
        {testCallStatus && (
          <Alert
            variant={testCallStatus.startsWith("✓") ? "success" : "danger"}
            className="rounded-2xl"
          >
            <AlertDescription>{testCallStatus}</AlertDescription>
          </Alert>
        )}

        {uploadError && (
          <Alert variant="danger" className="rounded-2xl">
            <AlertTitle>Manual Upload Failed</AlertTitle>
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        {/* Technical Parameters & Contacts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Cpu className="h-4 w-4 text-[#ff5733]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Machine Specifications
              </h3>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-slate-400 font-medium">Rated Operating RPM</dt>
                <dd data-metric className="font-semibold text-slate-900 text-sm mt-0.5 tabular-nums">
                  {machine.rated_rpm ? `${machine.rated_rpm.toLocaleString()} RPM` : "Unspecified"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">Health Status</dt>
                <dd
                  className={`font-semibold text-sm mt-0.5 ${
                    machine.status === "HEALTHY"
                      ? "text-emerald-700"
                      : machine.status === "LEARNING"
                      ? "text-blue-700"
                      : machine.status === "ALERT"
                      ? "text-rose-700"
                      : "text-slate-600"
                  }`}
                >
                  {machine.status || "HEALTHY"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">Audio Language</dt>
                <dd className="font-semibold text-slate-900 text-xs mt-0.5 uppercase">
                  {machine.language || "en"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">Last Telemetry Heartbeat</dt>
                <dd className="font-medium text-slate-800 text-xs mt-0.5">
                  {machine.last_seen_at ? formatISTDateTime(machine.last_seen_at) : "No telemetry recorded"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Phone className="h-4 w-4 text-[#ff5733]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Emergency Voice & Dispatch
              </h3>
            </div>
            <dl className="space-y-3 text-xs">
              <div className="bg-[#f7f7f8] p-3 rounded-xl border border-slate-200/60">
                <dt className="text-slate-500 font-medium">Supervisor Contact (AI Voice Call)</dt>
                <dd className="text-slate-900 font-semibold text-sm mt-1">
                  {machine.supervisor_name ?? "Lead"} &bull;{" "}
                  <span className="font-mono">{maskPhone(machine.supervisor_phone)}</span>
                </dd>
              </div>
              {machine.backup_phone && (
                <div className="bg-[#f7f7f8] p-3 rounded-xl border border-slate-200/60">
                  <dt className="text-slate-500 font-medium">Backup Escalation (SMS Notification)</dt>
                  <dd className="text-slate-900 font-semibold text-sm mt-1 font-mono">
                    {maskPhone(machine.backup_phone)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Manual Upload Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#ff5733]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Equipment Operating Manual (RAG Knowledge Grounding)
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Upload OEM equipment manuals in PDF. Content is automatically parsed into semantic chunks to ground AI root-cause diagnosis.
              </p>
            </div>
            <div>
              <label className="inline-flex items-center justify-center gap-2 font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs px-4 py-2.5 cursor-pointer shadow-sm transition-all">
                <Upload className="h-3.5 w-3.5 text-slate-500" />
                {isUploading ? "Uploading & Embedding..." : "Upload PDF Manual"}
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
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">Vibration Anomaly Incidents</h2>
              <p className="text-xs text-slate-500">Recent telemetry threshold breaches and AI diagnosis events.</p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              {events.length} Incident(s)
            </span>
          </div>

          {eventsLoading ? (
            <div className="py-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
              <Spinner size="sm" className="text-[#ff5733]" />
              Loading anomaly history...
            </div>
          ) : events.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-sm text-slate-500 space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="font-semibold text-slate-800">No anomaly events recorded</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Machine vibration baseline is stable. Any statistical outliers will be recorded here and trigger voice escalation.
              </p>
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
