import React from "react";
import Link from "next/link";
import type { Machine } from "@/types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatISTDateTime, maskPhone } from "@/lib/format";

export interface MachineCardProps {
  machine: Machine;
}

export function MachineCard({ machine }: MachineCardProps) {
  const isOnline = machine.device_online;
  const openAlerts = machine.open_alerts;

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-bold">{machine.name}</CardTitle>
            <p className="text-xs font-mono text-slate-500 mt-0.5">
              Type: {machine.machine_type} {machine.model ? `(${machine.model})` : ""}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-slate-300"}`}
              title={isOnline ? "Device Online" : "Device Offline"}
            />
            <span className="text-xs font-medium text-slate-600">
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md">
          <div>
            <span className="text-slate-400 block">Rated RPM</span>
            <span className="font-semibold text-slate-800">
              {machine.rated_rpm ? `${machine.rated_rpm} RPM` : "Unspecified"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Health Status</span>
            <span className="font-semibold text-slate-800 font-mono">{machine.status}</span>
          </div>
          <div className="col-span-2 pt-1 border-t border-slate-200">
            <span className="text-slate-400 block">Supervisor</span>
            <span className="font-semibold text-slate-800">
              {machine.supervisor_name ?? "Lead"} ({maskPhone(machine.supervisor_phone)})
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500">Active Anomaly Alerts</span>
          {openAlerts > 0 ? (
            <Badge variant="danger" className="animate-pulse px-2 py-0.5 font-bold">
              {openAlerts} {openAlerts === 1 ? "Alert" : "Alerts"}
            </Badge>
          ) : (
            <Badge variant="success">Normal (0)</Badge>
          )}
        </div>

        {machine.last_seen_at && (
          <p className="text-[11px] text-slate-400">
            Last Seen: {formatISTDateTime(machine.last_seen_at)}
          </p>
        )}
      </CardContent>

      <CardFooter className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <Link href={`/machines/${machine.id}/trend`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full text-xs min-h-[44px]">
            📊 Trend
          </Button>
        </Link>
        <Link href={`/machines/${machine.id}`} className="flex-1">
          <Button variant="primary" size="sm" className="w-full text-xs min-h-[44px]">
            Manage →
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
