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
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
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
          return; // Show handover dialog
        } catch {
          // If device already bound or fails, proceed to dashboard
          router.push("/dashboard");
          return;
        }
      }

      // No machines registered -> directly go to dashboard
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
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
        {/* Header */}
        <div className="flex items-center gap-3.5 pb-6 border-b border-slate-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#ff4724] to-[#ff7347] text-white shadow-sm shadow-[#ff5733]/20">
            <CheckCircle2 className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Step 4: Review & Finalize
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Confirm your factory setup before activating your monitoring copilot
            </p>
          </div>
        </div>

        <div className="pt-6">
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-sm font-medium text-rose-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
              <p>{errorMsg}</p>
            </div>
          )}

          {initialLoading ? (
            <div className="space-y-4 py-6">
              <div className="h-16 w-full animate-pulse rounded-xl bg-slate-100" />
              <div className="h-16 w-full animate-pulse rounded-xl bg-slate-100" />
              <div className="h-16 w-full animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Section 1: Personal Details */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                    <UserIcon className="h-4 w-4 text-[#ff5733]" />
                    <span>Personal Profile</span>
                  </div>
                  <Link
                    href="/onboarding/personal"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#ff5733] hover:underline min-h-[44px]"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Link>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400">Full Name</dt>
                    <dd className="font-semibold text-slate-800">{user?.full_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Phone Number</dt>
                    <dd className="font-semibold text-slate-800">{user?.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Voice Language</dt>
                    <dd className="font-semibold text-slate-800">
                      {user?.language === "hi" ? "हिन्दी (Hindi)" : "English"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Section 2: Factory Details */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                    <Building2 className="h-4 w-4 text-[#ff5733]" />
                    <span>Factory Details</span>
                  </div>
                  <Link
                    href="/onboarding/factory"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#ff5733] hover:underline min-h-[44px]"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Link>
                </div>
                {factory ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-400">Factory Name</dt>
                      <dd className="font-semibold text-slate-800">{factory.name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Industry Sector</dt>
                      <dd className="font-semibold text-slate-800 capitalize">
                        {factory.industry.replace("_", " ")}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-slate-400">Address</dt>
                      <dd className="font-semibold text-slate-800">
                        {factory.address_line}, {factory.city}, {factory.state} - {factory.pincode}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Workforce Scale</dt>
                      <dd className="font-semibold text-slate-800">{factory.employee_band}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">GSTIN</dt>
                      <dd className="font-semibold text-slate-800">{factory.gstin || "Not provided"}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-xs text-rose-600 pt-3">
                    Factory details missing. Please complete Step 2.
                  </p>
                )}
              </div>

              {/* Section 3: Machines */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                    <Cpu className="h-4 w-4 text-[#ff5733]" />
                    <span>Registered Machinery ({machines.length})</span>
                  </div>
                  <Link
                    href="/onboarding/machines"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#ff5733] hover:underline min-h-[44px]"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Link>
                </div>
                <div className="pt-3">
                  {machines.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        Machinery registration skipped. You will be able to register assets directly from your Fleet dashboard.
                      </span>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {machines.map((m, idx) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white border border-slate-200/70"
                        >
                          <span className="font-semibold text-slate-800">
                            {idx + 1}. {m.name} ({m.machine_type.toUpperCase()})
                          </span>
                          <span className="text-slate-500">{m.rated_rpm || 1450} RPM</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href="/onboarding/machines"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors min-h-[44px]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </Link>

                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={finishing || !factory || (machines.length === 0 && !skippedParam)}
                  className="h-12 min-h-[44px] px-8 flex items-center justify-center gap-2 rounded-xl bg-[#ff5733] hover:bg-[#ff451d] text-white font-semibold text-sm shadow-md shadow-[#ff5733]/25 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff5733] focus:ring-offset-2"
                >
                  <span>{finishing ? "Activating Copilot…" : "Finish & Activate Dashboard"}</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Device Key Handover Dialog */}
      {deviceCreated && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#ff4724] to-[#ff7347] text-white shadow-sm shadow-[#ff5733]/20">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Device Key Generated</h3>
                <p className="text-xs text-slate-500">
                  Sensor binding for &ldquo;{machines[0]?.name || "First Asset"}&rdquo;
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Save this key now!</p>
                <p className="mt-0.5">
                  This raw device key is shown exactly once and cannot be retrieved again from the system.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800">256-bit Sensor Device Key</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-900 select-all break-all">
                  {deviceCreated.device_key}
                </code>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors cursor-pointer"
                  aria-label="Copy device key"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-emerald-600 font-semibold">Copied to clipboard!</p>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-800">Deployment instructions for ESP32 sensor:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Flash the firmware onto your ESP32 accelerometer board.</li>
                <li>Configure the Wi-Fi credentials and paste this device key into config.</li>
                <li>Mount the sensor node securely onto the machine bearing housing.</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="ack-key"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#ff5733] focus:ring-[#ff5733]/30 cursor-pointer accent-[#ff5733]"
              />
              <label htmlFor="ack-key" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
                I have securely copied and saved this device key
              </label>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleEnterDashboard}
                disabled={!acknowledged}
                className="w-full h-12 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#ff5733] hover:bg-[#ff451d] text-white font-semibold text-sm shadow-md shadow-[#ff5733]/25 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff5733] focus:ring-offset-2"
              >
                <span>Enter Dashboard</span>
                <ArrowRight className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
              </button>
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
        <div className="py-12 text-center text-sm text-slate-400 animate-pulse">
          Loading review summary...
        </div>
      }
    >
      <ReviewContent />
    </React.Suspense>
  );
}
