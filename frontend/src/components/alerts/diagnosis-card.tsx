import React from "react";
import type { Diagnosis } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface DiagnosisCardProps {
  diagnosis: Diagnosis | null | undefined;
  diagnosisSource?: "llm" | "fallback" | null | undefined;
}

export function DiagnosisCard({ diagnosis, diagnosisSource }: DiagnosisCardProps) {
  if (!diagnosis) {
    return (
      <Card className="border-dashed border-slate-300 bg-slate-50">
        <CardContent className="p-6 text-center text-slate-500 text-sm">
          Diagnosis is being analyzed by edge rules and background worker...
        </CardContent>
      </Card>
    );
  }

  const isFallback = diagnosisSource === "fallback";

  const getSafeToRunLabel = (val: string) => {
    switch (val) {
      case "immediate":
        return "Immediate Action Required";
      case "end_of_shift":
        return "Safe until end of shift";
      case "24h":
        return "Safe up to 24 hours";
      default:
        return "Unknown - Inspect Soon";
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-base font-bold text-slate-900">
              Diagnostic Assessment
            </CardTitle>
            {isFallback ? (
              <Badge variant="warning" className="font-semibold" data-testid="rule-based-badge">
                ⚙️ Rule-based
              </Badge>
            ) : (
              <Badge variant="default" className="bg-purple-100 text-purple-800 border-purple-200">
                ✨ AI Synthesized (LLM + RAG)
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Badge
              variant={
                diagnosis.severity === "HIGH"
                  ? "danger"
                  : diagnosis.severity === "MEDIUM"
                    ? "warning"
                    : "default"
              }
            >
              Severity: {diagnosis.severity}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Recommended Action Box */}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
            Recommended Action
          </h4>
          <p className="text-sm font-medium text-blue-950">{diagnosis.recommended_action}</p>
          <div className="mt-2 text-xs font-semibold text-blue-800 flex items-center space-x-1">
            <span>⏱️ Window:</span>
            <span>{getSafeToRunLabel(diagnosis.safe_to_run_until)}</span>
          </div>
        </div>

        {/* Probable Causes Breakdown */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Probable Causes & Likelihood
          </h4>
          <div className="space-y-2">
            {diagnosis.probable_causes.map((cause, idx) => {
              const pct = Math.round(cause.confidence * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-800">{cause.cause}</span>
                    <span className="text-slate-500 font-mono">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${
                        pct >= 70
                          ? "bg-red-500"
                          : pct >= 40
                            ? "bg-amber-500"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {cause.evidence && (
                    <p className="text-[11px] text-slate-500 pl-1 pt-0.5">
                      {cause.evidence}
                    </p>
                  )}
                  {cause.manual_ref && (
                    <p className="text-[10px] text-slate-400 pl-1 italic">
                      Manual Citation: {cause.manual_ref}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Voice Call Brief */}
        {diagnosis.voice_summary && (
          <div className="border-t border-slate-100 pt-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Spoken Phone Briefing
            </h4>
            <p className="text-xs italic text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
              &ldquo;{diagnosis.voice_summary}&rdquo;
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
