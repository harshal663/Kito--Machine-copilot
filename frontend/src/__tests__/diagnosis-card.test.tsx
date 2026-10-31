import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiagnosisCard } from "../components/alerts/diagnosis-card";
import type { Diagnosis } from "../types";

const mockDiagnosis: Diagnosis = {
  severity: "HIGH",
  recommended_action: "Inspect shaft alignment and inspect flexible coupling.",
  safe_to_run_until: "immediate",
  voice_summary: "High vibration detected on slurry pump with strong 2x harmonics indicating misalignment.",
  probable_causes: [
    {
      cause: "Angular Misalignment",
      confidence: 0.85,
      evidence: "Strong 2x peak at 48.8 Hz, RMS increased 3.2x",
    },
    {
      cause: "Mass Unbalance",
      confidence: 0.15,
      evidence: "Minor 1x peak",
    },
  ],
};

describe("DiagnosisCard", () => {
  it("renders Rule-based badge when diagnosisSource is fallback", () => {
    render(<DiagnosisCard diagnosis={mockDiagnosis} diagnosisSource="fallback" />);

    const badge = screen.getByTestId("rule-based-badge");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("Rule-based");
    expect(screen.getByText("Angular Misalignment")).toBeDefined();
    expect(screen.getByText("Inspect shaft alignment and inspect flexible coupling.")).toBeDefined();
    expect(screen.getByText(/Immediate Action Required/i)).toBeDefined();
  });

  it("renders AI Synthesized badge when diagnosisSource is llm", () => {
    render(<DiagnosisCard diagnosis={mockDiagnosis} diagnosisSource="llm" />);

    expect(screen.queryByTestId("rule-based-badge")).toBeNull();
    expect(screen.getByText(/AI Synthesized/i)).toBeDefined();
  });

  it("renders pending placeholder when diagnosis is null", () => {
    render(<DiagnosisCard diagnosis={null} />);
    expect(screen.getByText(/Diagnosis is being analyzed/i)).toBeDefined();
  });
});
