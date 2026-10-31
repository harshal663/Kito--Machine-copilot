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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            Alerts Distribution (Last 14 Days)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Total of {totalAlerts} anomaly events recorded across your fleet
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {/* Screen reader text summary per prompt requirement */}
        <div className="sr-only">
          Bar chart showing daily anomaly alerts over the past 14 days. Total {totalAlerts} alerts recorded.
        </div>
        <div className="h-[240px] w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="date"
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
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const count = payload[0]?.value;
                    return (
                      <div className="rounded-lg border border-border bg-popover p-2.5 shadow-md">
                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                        <p className="text-sm font-bold text-foreground">
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
                fill="var(--status-alert)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

