"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, AlertCircle, Save, LogOut, User as UserIcon } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiClient, ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { isAuthenticated, signOut, setStoredUser } from "@/lib/auth";
import type { User, UserUpdateIn } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/sign-in");
    }
  }, [router]);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: queryKeys.user.me(),
    queryFn: () => apiClient.get<User>("/v1/me"),
  });

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [language, setLanguage] = React.useState<"en" | "hi">("en");
  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPhone(user.phone || "");
      if (user.language === "hi" || user.language === "en") {
        setLanguage(user.language);
      }
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (payload: UserUpdateIn) => apiClient.patch<User>("/v1/me", payload),
    onSuccess: (data) => {
      void queryClient.setQueryData(queryKeys.user.me(), data);
      setStoredUser({
        userId: data.id,
        email: data.email,
        fullName: data.full_name,
        role: data.role,
        onboardingCompleted: data.onboarding_completed,
        onboardingStep: data.onboarding_step,
      });
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
        setErrorMsg(err.message || "Failed to update profile.");
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
    if (!fullName.trim()) errors.fullName = "Full name is required.";
    if (phone.trim() && !/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      errors.phone = "Phone must be in E.164 format (e.g. +919876543210).";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    updateMutation.mutate({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      language,
    });
  };

  return (
    <AppShell title="Account Settings">
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Account Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Personal profile details, emergency voice dispatch language, and authentication session.
          </p>
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#ff5733] ring-1 ring-[#ff5733]/20">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Personal Contact & Voice Dispatch</h2>
              <p className="text-xs text-slate-500">
                Phone contact and preferred spoken language for AI voice calls
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
                <span>Profile updated successfully.</span>
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
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed font-medium"
                  />
                  <p className="text-[11px] text-slate-400">
                    Primary login identity cannot be modified after registration.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs font-semibold text-slate-700">
                    Account Role
                  </Label>
                  <Input
                    id="role"
                    type="text"
                    value={user?.role?.toUpperCase() || "OWNER"}
                    disabled
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700">
                    Full Name *
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
                  />
                  {fieldErrors.fullName && (
                    <p className="text-xs text-rose-600 mt-1">{fieldErrors.fullName}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">
                    Phone Number (E.164 format)
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15 font-mono"
                  />
                  <p className="text-[11px] text-slate-400">
                    Phone used for automated voice call diagnostics and emergency dispatch.
                  </p>
                  {fieldErrors.phone && (
                    <p className="text-xs text-rose-600 mt-1">{fieldErrors.phone}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="language" className="text-xs font-semibold text-slate-700">
                    Preferred Voice Alert Language
                  </Label>
                  <Select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
                    options={[
                      { value: "en", label: "English" },
                      { value: "hi", label: "हिन्दी (Hindi)" },
                    ]}
                    className="h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
                  />
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="min-h-[44px] px-6 text-xs font-semibold bg-[#ff5733] hover:bg-[#e04522] text-white shadow-sm gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {updateMutation.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Account Session Actions */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Session Management</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sign out from this browser session or switch operators
            </p>
          </div>
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="min-h-[44px] text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign out of Machine Copilot
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
