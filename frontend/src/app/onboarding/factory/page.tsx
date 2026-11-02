"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, MapPin, Briefcase, Users, FileText, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
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

export default function FactoryDetailsPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [industry, setIndustry] = React.useState("metal_machining");
  const [addressLine, setAddressLine] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [pincode, setPincode] = React.useState("");
  const [employeeBand, setEmployeeBand] = React.useState("11-25");
  const [gstin, setGstin] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let isMounted = true;
    async function loadFactory() {
      try {
        const fac = await apiClient.get<Factory>("/v1/factory");
        if (isMounted && fac) {
          setName(fac.name || "");
          setIndustry(fac.industry || "metal_machining");
          setAddressLine(fac.address_line || "");
          setCity(fac.city || "");
          setState(fac.state || "");
          setPincode(fac.pincode || "");
          setEmployeeBand(fac.employee_band || "11-25");
          setGstin(fac.gstin || "");
        }
      } catch {
        // Not found is expected for new accounts
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }
    void loadFactory();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Factory name is required.";
    if (!addressLine.trim()) errors.addressLine = "Street address is required.";
    if (!city.trim()) errors.city = "City is required.";
    if (!state.trim()) errors.state = "State is required.";
    if (!/^\d{6}$/.test(pincode.trim())) {
      errors.pincode = "Pincode must be exactly 6 digits (e.g. 400001).";
    }

    const trimmedGstin = gstin.trim().toUpperCase();
    if (
      trimmedGstin &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(trimmedGstin)
    ) {
      errors.gstin =
        "GSTIN must be a 15-character valid Indian GST format (e.g. 27AAAAA0000A1Z5).";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const payload: FactoryIn = {
        name: name.trim(),
        industry,
        address_line: addressLine.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        employee_band: employeeBand,
        gstin: trimmedGstin || null,
      };

      await apiClient.put<Factory>("/v1/factory", payload);
      router.push("/onboarding/machines");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "VALIDATION_ERROR") {
          setErrorMsg(err.message || "Please check your factory information.");
          if (err.details && typeof err.details === "object") {
            const mapped: Record<string, string> = {};
            for (const [k, v] of Object.entries(err.details)) {
              mapped[k] = String(v);
            }
            setFieldErrors(mapped);
          }
        } else {
          setErrorMsg(err.message || "Failed to save factory details.");
        }
      } else {
        setErrorMsg("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
      {/* Header */}
      <div className="flex items-center gap-3.5 pb-6 border-b border-slate-100">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#ff4724] to-[#ff7347] text-white shadow-sm shadow-[#ff5733]/20">
          <Building2 className="h-5 w-5 stroke-[2.2]" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Step 2: Factory Details
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Identify your manufacturing plant and location for shop floor monitoring
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
            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Factory Name & Industry Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Factory / Plant Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none text-slate-400">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <input
                    id="name"
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
                    placeholder="Sharma Castings Pvt Ltd"
                    className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                  />
                </div>
                {fieldErrors.name && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="industry" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Industry Sector <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none text-slate-400">
                    <Briefcase className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <select
                    id="industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all cursor-pointer"
                  >
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <label htmlFor="addressLine" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Street Address / Plot No. <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="addressLine"
                  type="text"
                  required
                  value={addressLine}
                  onChange={(e) => {
                    setAddressLine(e.target.value);
                    if (fieldErrors.addressLine) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.addressLine;
                        return next;
                      });
                    }
                  }}
                  placeholder="Plot 42, MIDC Industrial Area, Phase II"
                  className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                />
              </div>
              {fieldErrors.addressLine && (
                <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.addressLine}</p>
              )}
            </div>

            {/* City, State, Pincode */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  City <span className="text-rose-500">*</span>
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Pune"
                  className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                />
                {fieldErrors.city && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.city}</p>
                )}
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  State <span className="text-rose-500">*</span>
                </label>
                <input
                  id="state"
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Maharashtra"
                  className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                />
                {fieldErrors.state && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.state}</p>
                )}
              </div>

              <div>
                <label htmlFor="pincode" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Pincode <span className="text-rose-500">*</span>
                </label>
                <input
                  id="pincode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="411026"
                  className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                />
                {fieldErrors.pincode && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.pincode}</p>
                )}
              </div>
            </div>

            {/* Employee Band & GSTIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="employeeBand" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Factory Scale
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none text-slate-400">
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <select
                    id="employeeBand"
                    value={employeeBand}
                    onChange={(e) => setEmployeeBand(e.target.value)}
                    className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all cursor-pointer"
                  >
                    {EMPLOYEE_BANDS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="gstin" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  GSTIN (Optional)
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none text-slate-400">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <input
                    id="gstin"
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="27AAAAA0000A1Z5"
                    maxLength={15}
                    className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all uppercase"
                  />
                </div>
                {fieldErrors.gstin && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.gstin}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center justify-between">
              <Link
                href="/onboarding/personal"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="h-12 min-h-[44px] px-6 flex items-center justify-center gap-2 rounded-xl bg-[#ff5733] hover:bg-[#ff451d] text-white font-semibold text-sm shadow-md shadow-[#ff5733]/25 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff5733] focus:ring-offset-2"
              >
                <span>{loading ? "Saving…" : "Continue to Machinery Setup"}</span>
                <ArrowRight className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
