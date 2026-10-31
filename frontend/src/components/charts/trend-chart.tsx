"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { TrendPoint } from "@/types";
import { formatDecimal, formatISTTime } from "@/lib/format";

export interface TrendChartProps {
  points: TrendPoint[];
  baselineMean?: number | null | undefined;
  baselineThreshold?: number | null | undefined;
}

export function TrendChart({
  points,
  baselineMean,
  baselineThreshold,
}: TrendChartProps) {
  if (!points || points.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-slate-300 rounded-lg bg-slate-50 text-slate-500 text-sm">
        No vibration telemetry data recorded yet for this time window.
      </div>
    );
  }

  const chartData = points.map((p) => ({
    time: formatISTTime(p.ts),
    rawTime: p.ts,
    rms: p.rms_g,
    isAlert: p.source === "alert_window" ? p.rms_g : null,
    mean: baselineMean ?? undefined,
    threshold: baselineThreshold ?? undefined,
  }));

  return (
    <div className="w-full h-80 bg-white p-4 rounded-lg border border-slate-200">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "#64748b" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            unit="g"
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0]?.payload as { rawTime: string; rms: number };
                return (
                  <div className="bg-slate-900 text-white text-xs p-3 rounded shadow-lg border border-slate-700">
                    <p className="text-slate-400 mb-1">{data.rawTime}</p>
                    <p className="font-bold text-blue-400">
                      RMS: {formatDecimal(data.rms, 4)} g
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="rms"
            name="RMS Vibration (g)"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
          />
          {baselineThreshold !== null && baselineThreshold !== undefined && (
            <Line
              type="monotone"
              dataKey="threshold"
              name="Anomaly Threshold"
              stroke="#dc2626"
              strokeDasharray="4 4"
              dot={false}
            />
          )}
          {baselineMean !== null && baselineMean !== undefined && (
            <Line
              type="monotone"
              dataKey="mean"
              name="Baseline Mean"
              stroke="#16a34a"
              strokeDasharray="2 2"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
