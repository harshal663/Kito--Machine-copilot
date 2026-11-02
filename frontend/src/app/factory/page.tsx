"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, AlertCircle, Save } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiClient, ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { isAuthenticated } from "@/lib/auth";
import type { Factory, FactoryIn } from "@/types";

const INDUSTRY_OPTIONS = [
  { value: "metal_machining", label: "Metal Machining & CNC" },
  { value: "automotive", label: "Automotive & Auto-Components" },
  { value: "textiles", label: "Textiles & Garments" },
  { value: "food_beverage", label: "Food & Beverage Processing" },
  { value: "pharmaceuticals", label: "Pharmaceuticals & Chemicals" },
  { value: "plastics", label: "Plastics & Polymers" },
  { value: "packaging", label: "Packaging & Printing" },
  { value: "heavy_engineering", label: "Heavy Engineering & Fabrication" },
  { value: "other", label: "Other Manufacturing" },
];

const EMPLOYEE_BANDS = [
  { value: "1-10", label: "1 - 10 employees (Micro)" },
  { value: "11-25", label: "11 - 25 employees (Small)" },
  { value: "26-50", label: "26 - 50 employees (Medium)" },
  { value: "50+", label: "50+ employees (Large enterprise)" },
];

export default function FactoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/sign-in");
    }
  }, [router]);

  const { data: factory, isLoading } = useQuery<Factory>({
    queryKey: queryKeys.factory.mine(),
    queryFn: () => apiClient.get<Factory>("/v1/factory"),
  });

  const [name, setName] = React.useState("");
  const [industry, setIndustry] = React.useState("metal_machining");
  const [addressLine, setAddressLine] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [pincode, setPincode] = React.useState("");
  const [employeeBand, setEmployeeBand] = React.useState("11-25");
  const [gstin, setGstin] = React.useState("");

  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (factory) {
      setName(factory.name || "");
      setIndustry(factory.industry || "metal_machining");
      setAddressLine(factory.address_line || "");
      setCity(factory.city || "");
      setState(factory.state || "");
      setPincode(factory.pincode || "");
      setEmployeeBand(factory.employee_band || "11-25");
      setGstin(factory.gstin || "");
    }
  }, [factory]);

  const updateMutation = useMutation({
    mutationFn: (payload: FactoryIn) => apiClient.put<Factory>("/v1/factory", payload),
    onSuccess: (data) => {
      void queryClient.setQueryData(queryKeys.factory.mine(), data);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.code === "VALIDATION_ERROR" && err.details && typeof err.details === "object") {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(err.details)) {
            mapped[k] = String(v);
          }
          setFieldErrors(mapped);
        }
        setErrorMsg(err.message || "Failed to update factory information.");
      } else {
        setErrorMsg("Network error occurred.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Factory name is required.";
    if (!addressLine.trim()) errors.addressLine = "Street address is required.";
    if (!city.trim()) errors.city = "City is required.";
    if (!state.trim()) errors.state = "State is required.";
    if (!/^\d{6}$/.test(pincode.trim())) {
      errors.pincode = "Pincode must be exactly 6 digits.";
    }

    const trimmedGstin = gstin.trim().toUpperCase();
    if (
      trimmedGstin &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(trimmedGstin)
    ) {
      errors.gstin = "Invalid 15-character GSTIN format.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    updateMutation.mutate({
      name: name.trim(),
      industry,
      address_line: addressLine.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      employee_band: employeeBand,
      gstin: trimmedGstin || null,
    });
  };

  return (
    <AppShell title="Factory Profile">
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Factory Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Plant location, operational metadata, and industrial sector classification.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#ff5733] ring-1 ring-[#ff5733]/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Plant Location & Operations</h2>
              <p className="text-xs text-slate-500">
                Registered manufacturing location for industrial machinery tracking
              </p>
            </div>
          </div>

          <div className="pt-6">
            {errorMsg && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {savedSuccess && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700">
                <Check className="h-4 w-4 shrink-0" />
                <span>Factory profile updated successfully.</span>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-4 py-8 animate-pulse">
                <div className="h-11 w-full rounded-xl bg-slate-100" />
                <div className="h-11 w-full rounded-xl bg-slate-100" />
                <div className="h-11 w-full rounded-xl bg-slate-100" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="facName" className="text-xs font-semibold text-slate-700">
                      Factory Name
                    </Label>
                    <Input
                      id="facName"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
                    />
                    {fieldErrors.name && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.name}</p>
                    )}
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="facIndustry" className="text-xs font-semibold text-slate-700">
                      Industry Sector
                    </Label>
                    <Select
                      id="facIndustry"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      options={INDUSTRY_OPTIONS}
                      className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="facAddress" className="text-xs font-semibold text-slate-700">
                      Plant Street Address
                    </Label>
                    <Input
                      id="facAddress"
                      type="text"
                      required
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
                    />
                    {fieldErrors.addressLine && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.addressLine}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="facCity" className="text-xs font-semibold text-slate-700">
                      City
                    </Label>
                    <Input
                      id="facCity"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
                    />
                    {fieldErrors.city && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.city}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="facState" className="text-xs font-semibold text-slate-700">
                      State
                    </Label>
                    <Input
                      id="facState"
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
                    />
                    {fieldErrors.state && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.state}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="facPincode" className="text-xs font-semibold text-slate-700">
                      PIN Code (6 digits)
                    </Label>
                    <Input
                      id="facPincode"
                      type="text"
                      required
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15 font-mono"
                    />
                    {fieldErrors.pincode && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.pincode}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="facBand" className="text-xs font-semibold text-slate-700">
                      Workforce Size
                    </Label>
                    <Select
                      id="facBand"
                      value={employeeBand}
                      onChange={(e) => setEmployeeBand(e.target.value)}
                      options={EMPLOYEE_BANDS}
                      className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="facGstin" className="text-xs font-semibold text-slate-700">
                      GSTIN (Optional)
                    </Label>
                    <Input
                      id="facGstin"
                      type="text"
                      maxLength={15}
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15 font-mono uppercase"
                    />
                    {fieldErrors.gstin && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.gstin}</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="min-h-[44px] px-6 text-xs font-semibold bg-[#ff5733] hover:bg-[#e04522] text-white shadow-sm gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
