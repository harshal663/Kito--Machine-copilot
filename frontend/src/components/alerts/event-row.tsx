import React from "react";
import Link from "next/link";
import type { EventSummary } from "@/types";
import { Badge } from "@/components/ui/badge";
import { formatDecimal, formatISTDateTime } from "@/lib/format";

export interface EventRowProps {
  event: EventSummary;
}

export function EventRow({ event }: EventRowProps) {
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

  const getSeverityBadgeVariant = (severity?: string | null) => {
    switch (severity) {
      case "HIGH":
        return "danger";
      case "MEDIUM":
        return "warning";
      case "LOW":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors gap-3">
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <Badge variant={getStatusBadgeVariant(event.status)} className="font-mono text-[11px]">
            {event.status}
          </Badge>
          {event.severity && (
            <Badge variant={getSeverityBadgeVariant(event.severity)} className="text-[11px]">
              {event.severity}
            </Badge>
          )}
          <span className="text-xs text-slate-500">{formatISTDateTime(event.created_at)}</span>
        </div>

        <div className="flex items-center space-x-4 text-xs text-slate-600 pt-1">
          <span>
            Vibration RMS: <strong>{formatDecimal(event.rms_g, 3)} g</strong>
          </span>
          <span>
            Z-Score: <strong>+{formatDecimal(event.z_score, 1)}σ</strong>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Link href={`/events/${event.id}`}>
          <button className="text-xs font-semibold text-blue-600 hover:text-blue-800 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            View Diagnosis & Decision →
          </button>
        </Link>
      </div>
    </div>
  );
}
