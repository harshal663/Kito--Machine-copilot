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
      <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-white p-6 text-slate-500 text-sm">
        <p className="font-semibold text-slate-800">No vibration telemetry recorded</p>
        <p className="text-xs text-slate-400 mt-1">No samples match the selected time window.</p>
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
    <div className="w-full bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: "#64748b" }}
              interval="preserveStartEnd"
              stroke="#cbd5e1"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              unit="g"
              domain={["auto", "auto"]}
              stroke="#cbd5e1"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0]?.payload as { rawTime: string; rms: number };
                  return (
                    <div className="bg-slate-900/95 backdrop-blur-sm text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800">
                      <p className="text-slate-400 mb-1">{data.rawTime}</p>
                      <p className="font-bold text-[#ff5733] tabular-nums text-sm">
                        RMS: {formatDecimal(data.rms, 4)} g
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
            <Line
              type="monotone"
              dataKey="rms"
              name="RMS Vibration (g)"
              stroke="#ff5733"
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: "#ff5733" }}
              activeDot={{ r: 6, fill: "#ff5733", stroke: "#ffffff", strokeWidth: 2 }}
            />
            {baselineThreshold !== null && baselineThreshold !== undefined && (
              <Line
                type="monotone"
                dataKey="threshold"
                name="Anomaly Threshold"
                stroke="#e11d48"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
              />
            )}
            {baselineMean !== null && baselineMean !== undefined && (
              <Line
                type="monotone"
                dataKey="mean"
                name="Baseline Mean"
                stroke="#94a3b8"
                strokeDasharray="2 2"
                strokeWidth={1.5}
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Accessible data table for screen readers & tabular review */}
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-600 hover:text-[#ff5733] select-none py-1">
          View data points table ({chartData.length} samples)
        </summary>
        <div className="mt-2 max-h-48 overflow-y-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f7f7f8] text-slate-700 sticky top-0">
              <tr>
                <th className="p-2 pl-3">Timestamp (IST)</th>
                <th className="p-2">RMS (g)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {chartData.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-2 pl-3 font-mono text-slate-600">{d.time}</td>
                  <td className="p-2 font-mono font-semibold text-slate-900 tabular-nums">
                    {formatDecimal(d.rms, 4)} g
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
