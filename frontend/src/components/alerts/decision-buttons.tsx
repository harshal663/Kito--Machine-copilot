"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiClient } from "@/lib/api-client";
import { formatISTDateTime } from "@/lib/format";
import type { EventStatus } from "@/types";

export interface DecisionButtonsProps {
  eventId: string;
  status: EventStatus;
  decision?: "ACKNOWLEDGED" | "INSPECTION_SCHEDULED" | "SHUTDOWN_REQUESTED" | null | undefined;
  decidedAt?: string | null | undefined;
  onDecisionSubmitted?: ((newStatus: EventStatus) => void) | undefined;
}

export function DecisionButtons({
  eventId,
  status,
  decision,
  decidedAt,
  onDecisionSubmitted,
}: DecisionButtonsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDecision, setCurrentDecision] = useState<string | null | undefined>(decision);
  const [currentDecidedAt, setCurrentDecidedAt] = useState<string | null | undefined>(decidedAt);

  const isTerminal =
    status === "ACKNOWLEDGED" ||
    status === "INSPECTION_SCHEDULED" ||
    status === "SHUTDOWN_REQUESTED" ||
    Boolean(currentDecision);

  const handleDecision = async (
    targetDecision: "ACKNOWLEDGED" | "INSPECTION_SCHEDULED" | "SHUTDOWN_REQUESTED"
  ) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/v1/events/${eventId}/decision`, {
        decision: targetDecision,
        note: `Manual human operator decision via web dashboard`,
      });
      setCurrentDecision(targetDecision);
      setCurrentDecidedAt(new Date().toISOString());
      onDecisionSubmitted?.(targetDecision);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record decision");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isTerminal) {
    return (
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Decision Recorded
        </h4>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-bold text-slate-900">
            {currentDecision || status}
          </span>
          {currentDecidedAt && (
            <span className="text-xs text-slate-500">
              at {formatISTDateTime(currentDecidedAt)}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 italic">
          This anomaly event has reached a terminal state. No further transitions allowed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg border border-slate-200">
      <div>
        <h4 className="text-sm font-bold text-slate-900">Operator Decision Action</h4>
        <p className="text-xs text-slate-500 mt-0.5">
          Select an operational response to conclude this anomaly lifecycle.
        </p>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertTitle>Action Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          onClick={() => handleDecision("ACKNOWLEDGED")}
          isLoading={isSubmitting}
          className="flex-1 min-h-[44px]"
          data-testid="btn-acknowledge"
        >
          ✓ Acknowledge (Normal)
        </Button>

        <Button
          variant="secondary"
          onClick={() => handleDecision("INSPECTION_SCHEDULED")}
          isLoading={isSubmitting}
          className="flex-1 min-h-[44px]"
          data-testid="btn-schedule-inspection"
        >
          🛠️ Schedule Inspection
        </Button>

        <Button
          variant="danger"
          onClick={() => handleDecision("SHUTDOWN_REQUESTED")}
          isLoading={isSubmitting}
          className="flex-1 min-h-[44px]"
          data-testid="btn-request-shutdown"
        >
          🛑 Request Shutdown
        </Button>
      </div>

      <p className="text-[11px] text-slate-500">
        ℹ️ <strong>Safety note:</strong> Selecting &ldquo;Request Shutdown&rdquo; logs an urgent
        operational directive for technicians on site. Per safety rules, this system does not
        actuate physical machines directly.
      </p>
    </div>
  );
}
