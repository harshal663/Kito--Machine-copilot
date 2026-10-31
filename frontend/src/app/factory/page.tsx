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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
        <Card className="border-border shadow-xs">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Factory Profile & Plant Location</CardTitle>
                <CardDescription>
                  Manage the registered plant details for industrial machinery tracking
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

            {savedSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4 shrink-0" />
                <span>Factory profile updated successfully.</span>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-4 py-8 animate-pulse">
                <div className="h-10 w-full rounded bg-muted" />
                <div className="h-10 w-full rounded bg-muted" />
                <div className="h-10 w-full rounded bg-muted" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="facName">Factory Name</Label>
                    <Input
                      id="facName"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11 min-h-[44px]"
                    />
                    {fieldErrors.name && (
                      <p className="text-xs text-destructive">{fieldErrors.name}</p>
                    )}
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="facIndustry">Industry Sector</Label>
                    <Select
                      id="facIndustry"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      options={INDUSTRY_OPTIONS}
                      className="h-11 min-h-[44px]"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="facAddress">Plant Street Address</Label>
                    <Input
                      id="facAddress"
                      type="text"
                      required
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className="h-11 min-h-[44px]"
                    />
                    {fieldErrors.addressLine && (
                      <p className="text-xs text-destructive">{fieldErrors.addressLine}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="facCity">City</Label>
                    <Input
                      id="facCity"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-11 min-h-[44px]"
                    />
                    {fieldErrors.city && (
                      <p className="text-xs text-destructive">{fieldErrors.city}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="facState">State</Label>
                    <Input
                      id="facState"
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="h-11 min-h-[44px]"
                    />
                    {fieldErrors.state && (
                      <p className="text-xs text-destructive">{fieldErrors.state}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="facPincode">PIN Code</Label>
                    <Input
                      id="facPincode"
                      type="text"
                      required
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="h-11 min-h-[44px]"
                    />
                    {fieldErrors.pincode && (
                      <p className="text-xs text-destructive">{fieldErrors.pincode}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="facBand">Workforce Size</Label>
                    <Select
                      id="facBand"
                      value={employeeBand}
                      onChange={(e) => setEmployeeBand(e.target.value)}
                      options={EMPLOYEE_BANDS}
                      className="h-11 min-h-[44px]"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="facGstin">GSTIN</Label>
                    <Input
                      id="facGstin"
                      type="text"
                      maxLength={15}
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      className="h-11 min-h-[44px] uppercase"
                    />
                    {fieldErrors.gstin && (
                      <p className="text-xs text-destructive">{fieldErrors.gstin}</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="min-h-[44px] px-6 text-sm font-medium"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

