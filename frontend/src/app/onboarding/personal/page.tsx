"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { User as UserIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { apiClient, ApiError } from "@/lib/api-client";
import { getStoredUser, setStoredUser } from "@/lib/auth";
import type { User, UserUpdateIn } from "@/types";

export default function PersonalDetailsPage() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [language, setLanguage] = React.useState<"en" | "hi">("en");
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      try {
        const user = await apiClient.get<User>("/v1/me");
        if (isMounted) {
          if (user.full_name) setFullName(user.full_name);
          if (user.phone) setPhone(user.phone);
          if (user.language === "hi" || user.language === "en") setLanguage(user.language);
        }
      } catch {
        const local = getStoredUser();
        if (isMounted && local?.fullName) {
          setFullName(local.fullName);
        }
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }
    void loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }
    if (phone.trim() && !/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      newErrors.phone = "Phone number must be in E.164 format (e.g. +919876543210).";
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const payload: UserUpdateIn = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        language,
      };

      const updated = await apiClient.patch<User>("/v1/me", payload);

      setStoredUser({
        userId: updated.id,
        email: updated.email,
        fullName: updated.full_name,
        role: updated.role,
        onboardingCompleted: updated.onboarding_completed,
        onboardingStep: 2,
      });

      router.push("/onboarding/factory");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "VALIDATION_ERROR") {
          setErrorMsg(err.message || "Please check your personal details.");
          if (err.details && typeof err.details === "object") {
            const mapped: Record<string, string> = {};
            for (const [k, v] of Object.entries(err.details)) {
              mapped[k] = String(v);
            }
            setFieldErrors(mapped);
          }
        } else {
          setErrorMsg(err.message || "Failed to update personal details.");
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
            <UserIcon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-xl">Step 1: Personal Details</CardTitle>
            <CardDescription>
              Tell us about yourself and your communication preferences
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
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ramesh Patel"
                className="h-11 min-h-[44px]"
              />
              {fieldErrors.fullName && (
                <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number (for SMS & Voice Alerts)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                className="h-11 min-h-[44px]"
              />
              <p className="text-xs text-muted-foreground">
                Enter your mobile number with country code (E.164 format, e.g. +919876543210).
              </p>
              {fieldErrors.phone && (
                <p className="text-xs text-destructive">{fieldErrors.phone}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="language">Preferred Voice & UI Language</Label>
              <Select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
                options={[
                  { value: "en", label: "English (Default)" },
                  { value: "hi", label: "हिन्दी (Hindi)" },
                ]}
                className="h-11 min-h-[44px]"
              />
              <p className="text-xs text-muted-foreground">
                Automated phone calls and diagnostic briefings will use this language.
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                disabled={loading}
                className="min-h-[44px] px-6 text-base font-medium"
              >
                {loading ? "Saving..." : "Continue to Factory Details →"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

