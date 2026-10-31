import React from "react";
import type { Baseline, Peak } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDecimal } from "@/lib/format";

export interface EvidencePanelProps {
  rmsG: number;
  zScore: number;
  baseline: Baseline;
  peaks?: Peak[] | null | undefined;
  hints?: string[] | null | undefined;
}

export function EvidencePanel({
  rmsG,
  zScore,
  baseline,
  peaks,
  hints,
}: EvidencePanelProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-base font-bold text-slate-900">
          Sensor Evidence & Spectral Metrics
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
            <span className="text-xs text-slate-500 block">Trigger RMS</span>
            <span className="text-base font-mono font-bold text-slate-900">
              {formatDecimal(rmsG, 3)} g
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
            <span className="text-xs text-slate-500 block">Baseline Mean</span>
            <span className="text-base font-mono font-bold text-slate-900">
              {formatDecimal(baseline.mean, 3)} g
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
            <span className="text-xs text-slate-500 block">Baseline Std (σ)</span>
            <span className="text-base font-mono font-bold text-slate-900">
              {formatDecimal(baseline.std, 4)} g
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
            <span className="text-xs text-slate-500 block">Anomaly Z-Score</span>
            <span className="text-base font-mono font-bold text-red-600">
              +{formatDecimal(zScore, 1)}σ
            </span>
          </div>
        </div>

        {peaks && peaks.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Top Spectral Peaks (Radix-2 FFT)
            </h4>
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Peak #</th>
                    <th className="px-3 py-2 text-left font-semibold">Frequency (Hz)</th>
                    <th className="px-3 py-2 text-left font-semibold">Amplitude (g)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {peaks.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-400">P{idx + 1}</td>
                      <td className="px-3 py-2 text-slate-900 font-semibold">
                        {formatDecimal(p.freq_hz, 1)} Hz
                      </td>
                      <td className="px-3 py-2 text-slate-700">{formatDecimal(p.amp_g, 4)} g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hints && hints.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-xs text-amber-900">
            <span className="font-semibold block mb-1">🔍 Edge Diagnostic Hints</span>
            <ul className="list-disc pl-4 space-y-0.5">
              {hints.map((hint, idx) => (
                <li key={idx}>{hint}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
