"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Edit2,
  Copy,
  Check,
  Key,
  AlertTriangle,
  AlertCircle,
  Building2,
  User as UserIcon,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { apiClient, ApiError } from "@/lib/api-client";
import { setStoredUser } from "@/lib/auth";
import type { User, Factory, Machine, PageMachine, DeviceCreated } from "@/types";

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skippedParam =
    searchParams.get("skipped") === "true" ||
    (typeof window !== "undefined" &&
      sessionStorage.getItem("mc_onboarding_skipped_machines") === "true");

  const [user, setUser] = React.useState<User | null>(null);
  const [factory, setFactory] = React.useState<Factory | null>(null);
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [finishing, setFinishing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Device key handover modal state
  const [deviceCreated, setDeviceCreated] = React.useState<DeviceCreated | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    async function loadAll() {
      try {
        const [meData, facData, mchData] = await Promise.allSettled([
          apiClient.get<User>("/v1/me"),
          apiClient.get<Factory>("/v1/factory"),
          apiClient.get<PageMachine>("/v1/machines?limit=50"),
        ]);

        if (!isMounted) return;

        if (meData.status === "fulfilled") setUser(meData.value);
        if (facData.status === "fulfilled") setFactory(facData.value);
        if (mchData.status === "fulfilled") setMachines(mchData.value.items || []);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }
    void loadAll();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyKey = async () => {
    if (!deviceCreated?.device_key) return;
    try {
      await navigator.clipboard.writeText(deviceCreated.device_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleFinish = async () => {
    setErrorMsg(null);
    setFinishing(true);

    const machinesSkipped = machines.length === 0;

    try {
      // 1. Mark onboarding complete in backend
      const updatedUser = await apiClient.post<User>("/v1/onboarding/complete", {
        machines_skipped: machinesSkipped,
      });

      // Update local storage
      setStoredUser({
        userId: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        role: updatedUser.role,
        onboardingCompleted: true,
        onboardingStep: 4,
      });

      // 2. If machines were registered, generate a device key for the first machine
      const firstMachine = machines[0];
      if (firstMachine) {
        try {
          const dev = await apiClient.post<DeviceCreated>("/v1/devices", {
            machine_id: firstMachine.id,
          });
          setDeviceCreated(dev);
          setFinishing(false);
          return; // Show modal
        } catch {
          // If device already bound or fails, proceed to dashboard
          router.push("/dashboard");
          return;
        }
      }

      // No machines registered -> directly go to dashboard empty state
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "ONBOARDING_INCOMPLETE") {
          setErrorMsg(
            "Onboarding cannot be completed. Please ensure factory details are saved and at least one machine is registered (or skipped)."
          );
        } else {
          setErrorMsg(err.message || "Failed to finalize onboarding.");
        }
      } else {
        setErrorMsg("Network error. Please try again.");
      }
      setFinishing(false);
    }
  };

  const handleEnterDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xl">Step 4: Review & Finalize</CardTitle>
              <CardDescription>
                Confirm your factory setup before activating your monitoring copilot
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {initialLoading ? (
            <div className="space-y-4 py-6">
              <div className="h-16 w-full animate-pulse rounded bg-muted" />
              <div className="h-16 w-full animate-pulse rounded bg-muted" />
              <div className="h-16 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Section 1: Personal Details */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <UserIcon className="h-4 w-4 text-primary" />
                    <span>Personal Profile</span>
                  </div>
                  <Link
                    href="/onboarding/personal"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline min-h-[44px]"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Link>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Full Name</dt>
                    <dd className="font-medium text-foreground">{user?.full_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Phone Number</dt>
                    <dd className="font-medium text-foreground">{user?.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Voice Language</dt>
                    <dd className="font-medium text-foreground">
                      {user?.language === "hi" ? "हिन्दी (Hindi)" : "English"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Section 2: Factory Details */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span>Factory Details</span>
                  </div>
                  <Link
                    href="/onboarding/factory"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline min-h-[44px]"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Link>
                </div>
                {factory ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Factory Name</dt>
                      <dd className="font-medium text-foreground">{factory.name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Industry</dt>
                      <dd className="font-medium text-foreground capitalize">
                        {factory.industry.replace("_", " ")}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Address</dt>
                      <dd className="font-medium text-foreground">
                        {factory.address_line}, {factory.city}, {factory.state} - {factory.pincode}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Workforce Size</dt>
                      <dd className="font-medium text-foreground">{factory.employee_band}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">GSTIN</dt>
                      <dd className="font-medium text-foreground">{factory.gstin || "Not provided"}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-xs text-destructive pt-3">
                    Factory details missing. Please complete Step 2.
                  </p>
                )}
              </div>

              {/* Section 3: Machines */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span>Registered Machinery ({machines.length})</span>
                  </div>
                  <Link
                    href="/onboarding/machines"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline min-h-[44px]"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Link>
                </div>
                <div className="pt-3">
                  {machines.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        Machinery registration skipped. You will be able to add machines directly
                        from the dashboard empty state.
                      </span>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {machines.map((m, idx) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between text-xs p-2 rounded bg-muted/40"
                        >
                          <span className="font-medium text-foreground">
                            {idx + 1}. {m.name} ({m.machine_type.toUpperCase()})
                          </span>
                          <span className="text-muted-foreground">{m.rated_rpm || 1450} RPM</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-6 border-t border-border flex items-center justify-between">
                <Link href="/onboarding/machines">
                  <Button type="button" variant="outline" className="min-h-[44px] px-4">
                    ← Back
                  </Button>
                </Link>

                <Button
                  type="button"
                  onClick={handleFinish}
                  disabled={finishing || !factory || (machines.length === 0 && !skippedParam)}
                  className="min-h-[44px] px-8 text-base font-medium"
                >
                  {finishing ? "Activating Copilot..." : "Finish & Activate Dashboard"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Key Handover Dialog */}
      {deviceCreated && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Device Key Generated</h3>
                <p className="text-xs text-muted-foreground">
                  Binding for &ldquo;{machines[0]?.name || "First Machine"}&rdquo;
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold">Save this key now!</p>
                <p className="mt-0.5">
                  This raw device key is shown exactly once and cannot be retrieved again from the
                  system.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Device Key</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-border bg-muted/60 p-2.5 font-mono text-xs text-foreground select-all break-all">
                  {deviceCreated.device_key}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyKey}
                  className="shrink-0 min-h-[44px] min-w-[44px]"
                  aria-label="Copy device key"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {copied && (
                <p className="text-xs text-emerald-600 font-medium">Copied to clipboard!</p>
              )}
            </div>

            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">Next steps for ESP32 edge deployment:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Flash the firmware onto your ESP32 accelerometer board.</li>
                <li>Configure the Wi-Fi credentials and paste this device key into config.</li>
                <li>Mount the sensor node securely onto the machine bearing housing.</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="ack-key"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary min-h-[20px] min-w-[20px]"
              />
              <label htmlFor="ack-key" className="text-xs text-foreground cursor-pointer select-none">
                I have securely copied and saved this device key
              </label>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                onClick={handleEnterDashboard}
                disabled={!acknowledged}
                className="w-full min-h-[44px] text-base font-medium"
              >
                Enter Dashboard →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewOnboardingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
          Loading review summary...
        </div>
      }
    >
      <ReviewContent />
    </React.Suspense>
  );
}
