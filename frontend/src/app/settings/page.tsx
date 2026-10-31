"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Check, AlertCircle, Save, LogOut } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
        <Card className="border-border shadow-xs">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SettingsIcon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Personal Account Settings</CardTitle>
                <CardDescription>
                  Manage your personal contact details and alert notification preferences
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
                <span>Profile updated successfully.</span>
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
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="h-11 min-h-[44px] bg-muted/50 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email address cannot be modified after account registration.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    type="text"
                    value={user?.role?.toUpperCase() || "OWNER"}
                    disabled
                    className="h-11 min-h-[44px] bg-muted/50 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 min-h-[44px]"
                  />
                  {fieldErrors.fullName && (
                    <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone Number (E.164 format)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="h-11 min-h-[44px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mobile number used for automated voice call diagnostics and urgent SMS.
                  </p>
                  {fieldErrors.phone && (
                    <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="language">Preferred Voice Language</Label>
                  <Select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
                    options={[
                      { value: "en", label: "English" },
                      { value: "hi", label: "हिन्दी (Hindi)" },
                    ]}
                    className="h-11 min-h-[44px]"
                  />
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="min-h-[44px] px-6 text-sm font-medium"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Account Session Actions */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Session Management</CardTitle>
            <CardDescription>
              Sign out from this terminal or revoke local browser credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => signOut()}
              className="min-h-[44px]"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out of Machine Copilot
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
