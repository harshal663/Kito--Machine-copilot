"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import { Activity } from "lucide-react";
import type { Machine, TrendPoint } from "@/types";

interface RmsLineChartProps {
  machines: Machine[];
  selectedMachineId: string;
  onSelectMachine: (machineId: string) => void;
  trendData: TrendPoint[];
  className?: string;
}

export function RmsLineChart({
  machines,
  selectedMachineId,
  onSelectMachine,
  trendData,
  className,
}: RmsLineChartProps) {
  const chartPoints = React.useMemo(() => {
    return trendData.map((p) => {
      const date = new Date(p.ts);
      const timeStr = date.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return {
        time: timeStr,
        rms_g: Number(p.rms_g.toFixed(3)),
        isAlert: p.source === "alert_window",
      };
    });
  }, [trendData]);

  const alertPoints = React.useMemo(() => {
    return chartPoints.filter((p) => p.isAlert);
  }, [chartPoints]);

  const selectedMachine = machines.find((m) => m.id === selectedMachineId);

  return (
    <section
      aria-labelledby="rms-title"
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs ${className || ""}`}
    >
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h2 id="rms-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#ff5733]" />
            Vibration RMS, live
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedMachine
              ? `Real-time RMS vibration for ${selectedMachine.name}`
              : "Continuous vibration telemetry measurements"}
          </p>
        </div>

        {/* Machine Picker */}
        {machines.length > 0 && (
          <div className="w-full sm:w-[220px]">
            <label htmlFor="rms-machine" className="sr-only">
              Machine
            </label>
            <select
              id="rms-machine"
              name="machine"
              value={selectedMachineId}
              onChange={(e) => onSelectMachine(e.target.value)}
              aria-label="Select machine for live vibration trend"
              className="w-full h-10 min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none cursor-pointer"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <figure className="chart mt-4" data-chart="rms-line">
        <div
          className="h-[240px] w-full"
          role="img"
          aria-label={`Line chart of vibration RMS for ${selectedMachine?.name || "selected machine"} over the last 24 hours`}
        >
          {chartPoints.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs font-medium text-slate-400">
              No live telemetry data recorded yet for this machine.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, "auto"]}
                  unit="g"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const val = payload[0]?.value;
                      const isAlert = payload[0]?.payload?.isAlert;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                          <p className="text-xs text-slate-400 font-medium">{label} IST</p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">
                            RMS: {val} g
                          </p>
                          {isAlert && (
                            <p className="mt-1 text-xs font-semibold text-rose-600">
                              * Anomaly Detected
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={0.8}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: "Warning (0.8g)", fill: "#d97706", fontSize: 10, position: "top" }}
                />
                <ReferenceLine
                  y={1.4}
                  stroke="#e11d48"
                  strokeDasharray="4 4"
                  label={{ value: "Critical (1.4g)", fill: "#be123c", fontSize: 10, position: "top" }}
                />
                <Line
                  type="monotone"
                  dataKey="rms_g"
                  stroke="#ff5733"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "#ff5733" }}
                />
                {alertPoints.map((pt, i) => (
                  <ReferenceDot
                    key={`alert-${i}-${pt.time}`}
                    x={pt.time}
                    y={pt.rms_g}
                    r={5}
                    fill="#e11d48"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <figcaption className="mt-2 text-xs text-slate-400">
          Threshold lines show warning and critical levels.
        </figcaption>
      </figure>

      {/* Accessible Table Alternative */}
      {chartPoints.length > 0 && (
        <details className="mt-3 text-xs text-slate-500 cursor-pointer">
          <summary className="font-semibold text-slate-600 hover:text-slate-900 select-none py-1">
            View data as table
          </summary>
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Vibration RMS data points</caption>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th scope="col" className="p-2">Time</th>
                  <th scope="col" className="p-2">RMS (g)</th>
                  <th scope="col" className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chartPoints.slice(-15).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2 font-mono">{row.time}</td>
                    <td className="p-2 font-bold" data-metric>{row.rms_g}</td>
                    <td className="p-2">
                      {row.isAlert ? (
                        <span className="text-rose-600 font-semibold">Anomaly</span>
                      ) : (
                        <span className="text-emerald-600 font-medium">Nominal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
