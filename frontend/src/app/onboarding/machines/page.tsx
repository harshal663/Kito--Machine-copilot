"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cpu, Activity, User, Phone, Plus, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
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
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mc_onboarding_skipped_machines", "true");
    }
    router.push("/onboarding/review?skipped=true");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
        {/* Header */}
        <div className="flex items-center gap-3.5 pb-6 border-b border-slate-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#ff4724] to-[#ff7347] text-white shadow-sm shadow-[#ff5733]/20">
            <Cpu className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Step 3: Register Machinery
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Add rotating industrial assets to monitor vibration telemetry and predict anomalies
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
              <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
              <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <form onSubmit={handleAddMachine} className="space-y-5" noValidate>
              {/* Asset Name */}
              <div>
                <label htmlFor="machineName" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Machine Name / Asset Tag <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none text-slate-400">
                    <Cpu className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <input
                    id="machineName"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.name;
                          return next;
                        });
                      }
                    }}
                    placeholder="CNC Main Spindle Lathe 04"
                    className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                  />
                </div>
                {fieldErrors.name && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.name}</p>
                )}
              </div>

              {/* Equipment Type & Rated RPM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="machineType" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Equipment Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="machineType"
                    value={machineType}
                    onChange={(e) => setMachineType(e.target.value)}
                    className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all cursor-pointer"
                  >
                    {MACHINE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ratedRpm" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Rated RPM <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-slate-400">
                      <Activity className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <input
                      id="ratedRpm"
                      type="number"
                      required
                      min={60}
                      max={60000}
                      value={ratedRpm}
                      onChange={(e) => {
                        setRatedRpm(e.target.value);
                        if (fieldErrors.ratedRpm) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.ratedRpm;
                            return next;
                          });
                        }
                      }}
                      placeholder="1450"
                      className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                    />
                  </div>
                  {fieldErrors.ratedRpm && (
                    <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.ratedRpm}</p>
                  )}
                </div>
              </div>

              {/* Supervisor Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="supervisorName" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Shift Supervisor Name
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-slate-400">
                      <User className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <input
                      id="supervisorName"
                      type="text"
                      value={supervisorName}
                      onChange={(e) => setSupervisorName(e.target.value)}
                      placeholder="R. Verma"
                      className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="supervisorPhone" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Supervisor Phone (for AI Calls)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-slate-400">
                      <Phone className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <input
                      id="supervisorPhone"
                      type="tel"
                      value={supervisorPhone}
                      onChange={(e) => {
                        setSupervisorPhone(e.target.value);
                        if (fieldErrors.supervisorPhone) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.supervisorPhone;
                            return next;
                          });
                        }
                      }}
                      placeholder="+919876543210"
                      className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                    />
                  </div>
                  {fieldErrors.supervisorPhone && (
                    <p className="mt-1 text-xs font-medium text-rose-600">
                      {fieldErrors.supervisorPhone}
                    </p>
                  )}
                </div>
              </div>

              {/* Add Machine Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 px-5 flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Plus className="h-4 w-4 text-[#ff5733]" />
                  <span>{loading ? "Adding Asset…" : "Add Machine to Fleet"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Registered Machines List */}
          {machines.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                Registered Equipment ({machines.length})
              </h2>
              <div className="space-y-2.5">
                {machines.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-500">
                          {m.machine_type.toUpperCase()} &middot; {m.rated_rpm} RPM
                          {m.supervisor_name ? ` &middot; Sup: ${m.supervisor_name}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200/70 text-slate-700">
                      Sensor unbound
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/onboarding/factory"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Link>

            <div className="flex items-center gap-3">
              {machines.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setShowSkipConfirm(true)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors min-h-[44px] cursor-pointer"
                >
                  Skip for now
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleContinue}
                className="h-12 min-h-[44px] px-6 flex items-center justify-center gap-2 rounded-xl bg-[#ff5733] hover:bg-[#ff451d] text-white font-semibold text-sm shadow-md shadow-[#ff5733]/25 active:scale-[0.99] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff5733] focus:ring-offset-2"
              >
                <span>Continue to Review</span>
                <ArrowRight className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Skip Confirmation Dialog */}
      {showSkipConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Skip machine setup?</h3>
            <p className="mt-2 text-sm text-slate-500">
              You can still finish onboarding and add machines later from the Fleet dashboard, but vibration monitoring requires at least one registered machine.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSkipConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px] cursor-pointer"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={handleConfirmSkip}
                className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl min-h-[44px] cursor-pointer"
              >
                Yes, skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
