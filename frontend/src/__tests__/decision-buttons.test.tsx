import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DecisionButtons } from "../components/alerts/decision-buttons";
import { apiClient } from "../lib/api-client";

describe("DecisionButtons", () => {
  it("renders 3 operator action buttons in non-terminal state", () => {
    render(<DecisionButtons eventId="evt_test_1" status="ANOMALY_DETECTED" />);

    expect(screen.getByTestId("btn-acknowledge")).toBeDefined();
    expect(screen.getByTestId("btn-schedule-inspection")).toBeDefined();
    expect(screen.getByTestId("btn-request-shutdown")).toBeDefined();
  });

  it("submits decision PATCH when button is clicked", async () => {
    const patchSpy = vi.spyOn(apiClient, "patch").mockResolvedValue({});
    const onDecision = vi.fn();

    render(
      <DecisionButtons
        eventId="evt_test_1"
        status="CALLING"
        onDecisionSubmitted={onDecision}
      />
    );

    const ackButton = screen.getByTestId("btn-acknowledge");
    fireEvent.click(ackButton);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(
        "/v1/events/evt_test_1/decision",
        expect.objectContaining({ decision: "ACKNOWLEDGED" })
      );
    });

    expect(onDecision).toHaveBeenCalledWith("ACKNOWLEDGED");
  });

  it("renders terminal decision banner when event is already decided", () => {
    render(
      <DecisionButtons
        eventId="evt_test_1"
        status="ACKNOWLEDGED"
        decision="ACKNOWLEDGED"
        decidedAt="2026-10-24T12:00:00Z"
      />
    );

    expect(screen.queryByTestId("btn-acknowledge")).toBeNull();
    expect(screen.getByText(/Decision Recorded/i)).toBeDefined();
    expect(screen.getByText(/ACKNOWLEDGED/i)).toBeDefined();
    expect(screen.getByText(/terminal state/i)).toBeDefined();
  });
});
