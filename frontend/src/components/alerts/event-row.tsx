"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Calendar } from "lucide-react";
import type { EventSummary } from "@/types";
import { StatusBadge } from "@/components/shell/status-badge";
import { formatDecimal, formatISTDateTime } from "@/lib/format";

export interface EventRowProps {
  event: EventSummary;
}

export function EventRow({ event }: EventRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border border-slate-200/90 rounded-2xl bg-white hover:bg-slate-50/80 transition-all gap-4 shadow-sm">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} />

          {event.severity && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                event.severity === "HIGH"
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : event.severity === "MEDIUM"
                  ? "bg-orange-50 text-orange-700 border border-orange-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              {event.severity}
            </span>
          )}

          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
            #{event.id.slice(0, 8).toUpperCase()}
          </span>

          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar className="h-3 w-3 text-slate-400" />
            <time dateTime={event.created_at}>{formatISTDateTime(event.created_at)}</time>
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="text-slate-400">Vibration RMS:</span>
            <strong data-metric className="font-semibold text-slate-900 tabular-nums">
              {formatDecimal(event.rms_g, 3)} g
            </strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-slate-400">Z-Score:</span>
            <strong data-metric className="font-semibold text-[#ff5733] tabular-nums">
              +{formatDecimal(event.z_score, 1)}σ
            </strong>
          </span>
        </div>
      </div>

      <div className="flex items-center sm:justify-end">
        <Link href={`/events/${event.id}`}>
          <button className="text-xs font-semibold text-slate-700 hover:text-[#ff5733] py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200 transition-all flex items-center gap-1.5">
            View Diagnosis & Decision
            <ArrowRight className="h-3.5 w-3.5 text-[#ff5733]" />
          </button>
        </Link>
      </div>
    </div>
  );
}
