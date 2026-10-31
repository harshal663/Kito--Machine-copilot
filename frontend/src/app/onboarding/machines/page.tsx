"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cpu, Plus, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { apiClient, ApiError } from "@/lib/api-client";
import type { Machine, PageMachine } from "@/types";

const MACHINE_TYPES = [
  { value: "motor", label: "Induction Motor" },
  { value: "pump", label: "Centrifugal Pump" },
  { value: "fan", label: "Industrial Fan / Blower" },
  { value: "compressor", label: "Air / Gas Compressor" },
  { value: "conveyor", label: "Belt / Roller Conveyor" },
  { value: "gearbox", label: "Industrial Gearbox" },
  { value: "cnc", label: "CNC Milling / Lathe" },
  { value: "other", label: "Other Rotating Asset" },
];

export default function MachinesOnboardingPage() {
  const router = useRouter();
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [showSkipConfirm, setShowSkipConfirm] = React.useState(false);

  // Machine form state
  const [name, setName] = React.useState("");
  const [machineType, setMachineType] = React.useState("motor");
  const [ratedRpm, setRatedRpm] = React.useState("1450");
  const [supervisorName, setSupervisorName] = React.useState("");
  const [supervisorPhone, setSupervisorPhone] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let isMounted = true;
    async function loadMachines() {
      try {
        const res = await apiClient.get<PageMachine>("/v1/machines?limit=50");
        if (isMounted) {
          setMachines(res.items || []);
        }
      } catch {
        // Ignore error on load
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }
    void loadMachines();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Machine name is required.";
    const parsedRpm = Number(ratedRpm);
    if (!ratedRpm || isNaN(parsedRpm) || parsedRpm < 60 || parsedRpm > 60000) {
      errors.ratedRpm = "Rated RPM must be between 60 and 60,000 RPM.";
    }
    if (supervisorPhone.trim() && !/^\+[1-9]\d{7,14}$/.test(supervisorPhone.trim())) {
      errors.supervisorPhone = "Phone must be in E.164 format (e.g. +919876543210).";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const created = await apiClient.post<Machine>("/v1/machines", {
        name: name.trim(),
        machine_type: machineType,
        rated_rpm: parsedRpm,
        supervisor_name: supervisorName.trim() || undefined,
        supervisor_phone: supervisorPhone.trim() || undefined,
        criticality: "medium",
      });

      setMachines((prev) => [...prev, created]);
      // Reset form fields
      setName("");
      setSupervisorName("");
      setSupervisorPhone("");
      setRatedRpm("1450");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message || "Failed to create machine asset.");
      } else {
        setErrorMsg("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.push("/onboarding/review");
  };

  const handleConfirmSkip = () => {
    // Record in localStorage that machines were skipped
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mc_onboarding_skipped_machines", "true");
    }
    router.push("/onboarding/review?skipped=true");
  };

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xl">Step 3: Register Machinery</CardTitle>
              <CardDescription>
                Add your rotating equipment to monitor mechanical vibration and health
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {errorMsg && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {initialLoading ? (
            <div className="space-y-4 py-6">
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <form onSubmit={handleAddMachine} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="machineName">Machine Name / Asset Tag</Label>
                  <Input
                    id="machineName"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="CNC Main Spindle Motor #1"
                    className="h-11 min-h-[44px]"
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-destructive">{fieldErrors.name}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="machineType">Equipment Type</Label>
                  <Select
                    id="machineType"
                    value={machineType}
                    onChange={(e) => setMachineType(e.target.value)}
                    options={MACHINE_TYPES}
                    className="h-11 min-h-[44px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ratedRpm">Rated RPM</Label>
                  <Input
                    id="ratedRpm"
                    type="number"
                    required
                    min={60}
                    max={60000}
                    value={ratedRpm}
                    onChange={(e) => setRatedRpm(e.target.value)}
                    placeholder="1450"
                    className="h-11 min-h-[44px]"
                  />
                  {fieldErrors.ratedRpm && (
                    <p className="text-xs text-destructive">{fieldErrors.ratedRpm}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="supName">Shop Floor Supervisor Name</Label>
                  <Input
                    id="supName"
                    type="text"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    placeholder="Suresh Kumar"
                    className="h-11 min-h-[44px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="supPhone">Supervisor Phone (Voice Alerts)</Label>
                  <Input
                    id="supPhone"
                    type="tel"
                    value={supervisorPhone}
                    onChange={(e) => setSupervisorPhone(e.target.value)}
                    placeholder="+919876543211"
                    className="h-11 min-h-[44px]"
                  />
                  {fieldErrors.supervisorPhone && (
                    <p className="text-xs text-destructive">{fieldErrors.supervisorPhone}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  variant="secondary"
                  className="min-h-[44px] px-5"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {loading ? "Adding Asset..." : "Add Machine to Fleet"}
                </Button>
              </div>
            </form>
          )}

          {/* List of registered machines */}
          <div className="mt-8 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center justify-between">
              <span>Registered Machines ({machines.length})</span>
              {machines.length > 0 && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ready to link sensor node
                </span>
              )}
            </h3>

            {machines.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground bg-muted/20">
                No machines added yet. Fill the form above to add your first machine, or choose
                &quot;Add later&quot; to skip.
              </div>
            ) : (
              <div className="space-y-2.5">
                {machines.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-xs uppercase">
                        {m.machine_type.slice(0, 3)}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.machine_type.toUpperCase()} &bull; {m.rated_rpm || 1450} RPM
                          {m.supervisor_name && ` &bull; Sup: ${m.supervisor_name}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
                      ID: {m.id.slice(0, 10)}...
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Skip warning modal / alert */}
          {showSkipConfirm && (
            <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">Skip adding machines for now?</p>
                  <p className="text-xs text-muted-foreground">
                    Your dashboard will open in an empty state with no live telemetry until you
                    register a machine and bind an ESP32 accelerometer sensor.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleConfirmSkip}
                      className="min-h-[44px]"
                    >
                      Yes, skip to review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowSkipConfirm(false)}
                      className="min-h-[44px]"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-8 border-t border-border mt-6 flex items-center justify-between">
            <Link href="/onboarding/factory">
              <Button type="button" variant="outline" className="min-h-[44px] px-4">
                ← Back
              </Button>
            </Link>

            <div className="flex items-center gap-3">
              {machines.length === 0 && !showSkipConfirm && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowSkipConfirm(true)}
                  className="min-h-[44px] text-muted-foreground hover:text-foreground"
                >
                  Add later
                </Button>
              )}

              <Button
                type="button"
                onClick={handleContinue}
                disabled={machines.length === 0}
                className="min-h-[44px] px-6 text-base font-medium"
              >
                Continue to Review →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

