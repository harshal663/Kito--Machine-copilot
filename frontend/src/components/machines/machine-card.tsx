"use client";

import React from "react";
import Link from "next/link";
import { Gauge, Phone, TrendingUp, ArrowRight, ShieldCheck, AlertTriangle } from "lucide-react";
import type { Machine } from "@/types";
import { Card, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatISTDateTime, maskPhone } from "@/lib/format";

export interface MachineCardProps {
  machine: Machine;
}

export function MachineCard({ machine }: MachineCardProps) {
  const isOnline = Boolean(machine.device_online);
  const openAlerts = machine.open_alerts || 0;

  return (
    <Card
      data-testid={`machine-card-${machine.id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
    >
      {/* Top accent bar indicator */}
      <div
        className={`h-1 w-full ${
          openAlerts > 0
            ? "bg-rose-500"
            : isOnline
            ? "bg-emerald-500"
            : "bg-slate-300"
        }`}
      />

      <div className="p-5 pb-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-[#ff5733] ring-1 ring-[#ff5733]/20">
                <Gauge className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-base font-bold text-slate-900 group-hover:text-[#ff5733] transition-colors">
                  {machine.name}
                </CardTitle>
                <p className="truncate text-xs font-medium text-slate-500">
                  {machine.machine_type} {machine.model ? `• ${machine.model}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Online badge */}
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
            {isOnline ? "Live" : "Offline"}
          </span>
        </div>

        {/* Machine telemetry & metadata specs */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#f7f7f8] p-3 text-xs">
          <div>
            <span className="block text-[11px] font-medium text-slate-500">Rated RPM</span>
            <span className="font-semibold text-slate-800 tabular-nums">
              {machine.rated_rpm ? `${machine.rated_rpm.toLocaleString()} RPM` : "Unspecified"}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-medium text-slate-500">Health State</span>
            <span
              className={`font-semibold ${
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
            </span>
          </div>

          <div className="col-span-2 pt-2 border-t border-slate-200/70 flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Phone className="h-3 w-3 text-slate-400" aria-hidden="true" />
              Supervisor
            </span>
            <span className="font-medium text-slate-800 text-[11px]">
              {machine.supervisor_name ?? "Lead"} ({maskPhone(machine.supervisor_phone)})
            </span>
          </div>
        </div>

        {/* Anomaly pill */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Active Anomaly Status</span>
          {openAlerts > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {openAlerts} {openAlerts === 1 ? "Alert" : "Alerts"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/60">
              <ShieldCheck className="h-3 w-3" />
              Nominal
            </span>
          )}
        </div>

        {machine.last_seen_at && (
          <p className="mt-2 text-[11px] text-slate-400">
            Telemetry sync: {formatISTDateTime(machine.last_seen_at)}
          </p>
        )}
      </div>

      {/* Footer action buttons */}
      <CardFooter className="bg-slate-50/70 p-3 px-5 border-t border-slate-100 flex items-center gap-2">
        <Link href={`/machines/${machine.id}/trend`} className="flex-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
          >
            <TrendingUp className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
            Trend
          </Button>
        </Link>
        <Link href={`/machines/${machine.id}`} className="flex-1">
          <Button
            size="sm"
            className="w-full text-xs font-semibold bg-[#ff5733] hover:bg-[#e04522] text-white shadow-sm"
          >
            Manage
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
