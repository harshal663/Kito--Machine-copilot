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
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
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
    <Card className={className}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            24-Hour Vibration RMS Trend
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {selectedMachine
              ? `Monitoring ${selectedMachine.name} (rated ${selectedMachine.rated_rpm || 1500} RPM)`
              : "Select a machine to inspect continuous vibration measurements"}
          </p>
        </div>

        {/* Machine Picker */}
        {machines.length > 0 && (
          <div className="w-full sm:w-[200px]">
            <Select
              value={selectedMachineId}
              onChange={(e) => onSelectMachine(e.target.value)}
              aria-label="Select machine for vibration trend"
              className="h-9 min-h-[36px] text-xs"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Screen reader text summary per prompt requirement */}
        <div className="sr-only">
          Line chart showing root-mean-square vibration acceleration in g over the last 24 hours for machine{" "}
          {selectedMachine?.name}. {alertPoints.length} alert threshold spikes recorded.
        </div>
        <div className="h-[240px] w-full pt-3">
          {chartPoints.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No trend data available for this machine in the last 24 hours.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="currentColor"
                  className="text-xs text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="currentColor"
                  className="text-xs text-muted-foreground"
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
                        <div className="rounded-lg border border-border bg-popover p-2.5 shadow-md">
                          <p className="text-xs text-muted-foreground">{label} IST</p>
                          <p className="text-sm font-bold text-foreground">
                            RMS: {val} g
                          </p>
                          {isAlert && (
                            <p className="mt-1 text-xs font-semibold text-rose-500">
                              * Anomaly Alert Point
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rms_g"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                {alertPoints.map((pt, i) => (
                  <ReferenceDot
                    key={`alert-${i}-${pt.time}`}
                    x={pt.time}
                    y={pt.rms_g}
                    r={5}
                    fill="var(--status-alert)"
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

