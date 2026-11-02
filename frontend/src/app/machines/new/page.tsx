"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { MachineForm } from "@/components/machines/machine-form";

export default function NewMachinePage() {
  return (
    <AppShell title="Register Machine">
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <Link
            href="/machines"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#ff5733] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Machinery Fleet
          </Link>
        </div>

        <div className="border-b border-slate-200/80 pb-4">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Register Industrial Asset
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure mechanical baseline parameters and emergency escalation contacts for autonomous AI voice alerts.
          </p>
        </div>

        <MachineForm />
      </div>
    </AppShell>
  );
}
