import React from "react";
import type { CallAttempt } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatISTDateTime } from "@/lib/format";

export interface CallHistoryProps {
  attempts?: CallAttempt[] | null | undefined;
}

export function CallHistory({ attempts }: CallHistoryProps) {
  if (!attempts || attempts.length === 0) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Voice Call Log</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-500">
          No automated voice calls initiated yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-900">
            Voice Call Attempts & Escalation Log
          </CardTitle>
          <Badge variant="outline">{attempts.length} Attempt(s)</Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {attempts.map((att, idx) => {
          const isSuccess = att.state === "COMPLETED";
          const isFailed = att.state === "FAILED" || att.state === "NO_ANSWER" || att.state === "BUSY";

          return (
            <div
              key={att.id || idx}
              className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  Call Attempt #{att.attempt_no ?? idx + 1}
                </span>
                <Badge
                  variant={isSuccess ? "success" : isFailed ? "danger" : "warning"}
                  className="font-mono text-[11px]"
                >
                  {att.state}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block">Initiated At</span>
                  <span className="font-medium text-slate-800">
                    {formatISTDateTime(att.started_at)}
                  </span>
                </div>

                {att.ended_at && (
                  <div>
                    <span className="text-slate-400 block">Ended At</span>
                    <span className="font-medium text-slate-800">
                      {formatISTDateTime(att.ended_at)}
                    </span>
                  </div>
                )}
              </div>

              {att.extracted_decision && (
                <div className="pt-2 border-t border-slate-200 text-xs">
                  <span className="text-slate-500">Spoken Operator Decision: </span>
                  <span className="font-bold text-emerald-700">{att.extracted_decision}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
