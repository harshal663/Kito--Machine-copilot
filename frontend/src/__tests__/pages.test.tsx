import "@testing-library/jest-dom";
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MachineCard } from "@/components/machines/machine-card";
import { EventRow } from "@/components/alerts/event-row";
import { StatusBadge } from "@/components/shell/status-badge";
import type { Machine, EventSummary } from "@/types";

describe("Redesigned Light Components", () => {
  const mockMachine: Machine = {
    id: "mach_1234567890",
    factory_id: "fac_123456",
    name: "Primary Slurry Pump #3",
    machine_type: "Slurry Pump",
    model: "Warman 10/8 AH",
    rated_rpm: 1465,
    status: "HEALTHY",
    device_online: true,
    supervisor_name: "Ramesh Kumar",
    supervisor_phone: "+919876543210",
    backup_phone: "+919123456789",
    language: "en",
    open_alerts: 0,
    last_seen_at: "2026-11-01T12:00:00Z",
    created_at: "2026-11-01T10:00:00Z",
  };

  const mockEvent: EventSummary = {
    id: "evt_9876543210",
    machine_id: "mach_1234567890",
    status: "ANOMALY_DETECTED",
    severity: "HIGH",
    rms_g: 0.842,
    z_score: 3.4,
    created_at: "2026-11-01T12:30:00Z",
  };

  it("renders MachineCard with coral styling and masked phone", () => {
    render(<MachineCard machine={mockMachine} />);

    expect(screen.getByText("Primary Slurry Pump #3")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("1,465 RPM")).toBeInTheDocument();
    // Phone must be masked with asterisks
    expect(screen.getByText(/Ramesh Kumar \(\*{9}3210\)/)).toBeInTheDocument();
    expect(screen.getByText("Manage")).toBeInTheDocument();
    expect(screen.getByText("Trend")).toBeInTheDocument();
  });

  it("renders EventRow with StatusBadge and Z-Score metric", () => {
    render(<EventRow event={mockEvent} />);

    expect(screen.getByText("#EVT_9876")).toBeInTheDocument();
    expect(screen.getByText("+3.4σ")).toBeInTheDocument();
    expect(screen.getByText("0.842 g")).toBeInTheDocument();
    expect(screen.getByText("View Diagnosis & Decision")).toBeInTheDocument();
  });

  it("renders StatusBadge with accessible data-status attribute", () => {
    const { container } = render(<StatusBadge status="HEALTHY" />);
    const badge = container.querySelector("[data-status='healthy']");
    expect(badge).toBeInTheDocument();
  });
});
