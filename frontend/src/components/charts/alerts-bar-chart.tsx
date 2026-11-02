"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BellRing } from "lucide-react";

interface DailyAlertCount {
  date: string;
  count: number;
}

interface AlertsBarChartProps {
  data: DailyAlertCount[];
  className?: string;
}

export function AlertsBarChart({ data, className }: AlertsBarChartProps) {
  const totalAlerts = React.useMemo(
    () => data.reduce((acc, curr) => acc + curr.count, 0),
    [data]
  );

  return (
    <section
      aria-labelledby="dist-title"
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs ${className || ""}`}
    >
      <header className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 id="dist-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BellRing className="h-4 w-4 text-[#ff5733]" />
            Anomalies, last 7 days
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Total of {totalAlerts} anomaly events recorded across your fleet
          </p>
        </div>
      </header>

      <figure className="chart mt-4" data-chart="anomaly-bar-7d">
        <div
          className="h-[240px] w-full"
          role="img"
          aria-label={`Bar chart of anomalies per day, last 7 days. Total ${totalAlerts} alerts.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(-7)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
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
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const count = payload[0]?.value;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg">
                        <p className="text-xs font-medium text-slate-400">{label}</p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">
                          {count} {Number(count) === 1 ? "alert" : "alerts"}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="count"
                fill="#ff5733"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>

      {/* Accessible Table Alternative */}
      <details className="mt-3 text-xs text-slate-500 cursor-pointer">
        <summary className="font-semibold text-slate-600 hover:text-slate-900 select-none py-1">
          View data as table
        </summary>
        <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Anomalies per day</caption>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th scope="col" className="p-2">Date</th>
                <th scope="col" className="p-2">Alert Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.slice(-7).map((d) => (
                <tr key={d.date} className="hover:bg-slate-50">
                  <td className="p-2 font-medium">{d.date}</td>
                  <td className="p-2 font-bold" data-metric>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
