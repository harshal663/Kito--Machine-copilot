"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
    <Card className="border-border shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-xl">Step 2: Factory Details</CardTitle>
            <CardDescription>
              Register your manufacturing plant and location
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
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="factoryName">Factory / Plant Name</Label>
                <Input
                  id="factoryName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Apex Precision Components Plant 1"
                  className="h-11 min-h-[44px]"
                />
                {fieldErrors.name && (
                  <p className="text-xs text-destructive">{fieldErrors.name}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="industry">Industry Sector</Label>
                <Select
                  id="industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  options={INDUSTRY_OPTIONS}
                  className="h-11 min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="addressLine">Plant Address</Label>
                <Input
                  id="addressLine"
                  type="text"
                  required
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="Plot 42, MIDC Industrial Area"
                  className="h-11 min-h-[44px]"
                />
                {fieldErrors.addressLine && (
                  <p className="text-xs text-destructive">{fieldErrors.addressLine}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Pune"
                  className="h-11 min-h-[44px]"
                />
                {fieldErrors.city && (
                  <p className="text-xs text-destructive">{fieldErrors.city}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Maharashtra"
                  className="h-11 min-h-[44px]"
                />
                {fieldErrors.state && (
                  <p className="text-xs text-destructive">{fieldErrors.state}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pincode">PIN Code (6 digits)</Label>
                <Input
                  id="pincode"
                  type="text"
                  required
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="411019"
                  className="h-11 min-h-[44px]"
                />
                {fieldErrors.pincode && (
                  <p className="text-xs text-destructive">{fieldErrors.pincode}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="employeeBand">Workforce Size</Label>
                <Select
                  id="employeeBand"
                  value={employeeBand}
                  onChange={(e) => setEmployeeBand(e.target.value)}
                  options={EMPLOYEE_BANDS}
                  className="h-11 min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="gstin">GSTIN (Optional, 15 chars)</Label>
                <Input
                  id="gstin"
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="27ABCDE1234F1Z5"
                  className="h-11 min-h-[44px] uppercase"
                />
                {fieldErrors.gstin && (
                  <p className="text-xs text-destructive">{fieldErrors.gstin}</p>
                )}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <Link href="/onboarding/personal">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] px-4"
                >
                  ← Back
                </Button>
              </Link>

              <Button
                type="submit"
                disabled={loading}
                className="min-h-[44px] px-6 text-base font-medium"
              >
                {loading ? "Saving..." : "Continue to Machinery Setup →"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

