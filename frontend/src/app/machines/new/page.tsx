import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { MachineForm } from "@/components/machines/machine-form";

export default function NewMachinePage() {
  return (
    <AppShell title="Register Machine">
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/machines" className="hover:text-primary transition-colors">
            ← Back to Machines
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Register Industrial Asset
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Specify operating parameters and emergency contacts for AI diagnostic dispatch.
          </p>
        </div>

        <MachineForm />
      </div>
    </AppShell>
  );
}
