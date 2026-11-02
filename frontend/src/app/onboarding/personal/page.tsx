"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { User as UserIcon, Phone, Languages, AlertCircle, ArrowRight } from "lucide-react";
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
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
      {/* Header */}
      <div className="flex items-center gap-3.5 pb-6 border-b border-slate-100">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#ff4724] to-[#ff7347] text-white shadow-sm shadow-[#ff5733]/20">
          <UserIcon className="h-5 w-5 stroke-[2.2]" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Step 1: Personal Details
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Your name, phone number, and communication preferences for voice alerts
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
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400">
                  <UserIcon className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.fullName;
                        return next;
                      });
                    }
                  }}
                  placeholder="Ramesh Patel"
                  className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                />
              </div>
              {fieldErrors.fullName && (
                <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.fullName}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Phone Number (for SMS & Voice Alerts)
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.phone;
                        return next;
                      });
                    }
                  }}
                  placeholder="+919876543210"
                  className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                E.164 format with country code (e.g. +919876543210). Kept secure & masked.
              </p>
              {fieldErrors.phone && (
                <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.phone}</p>
              )}
            </div>

            {/* Language */}
            <div>
              <label htmlFor="language" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Preferred Voice & UI Language
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400">
                  <Languages className="h-4 w-4" aria-hidden="true" />
                </div>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
                  className="w-full h-12 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-xs focus:border-[#ff5733] focus:ring-2 focus:ring-[#ff5733]/20 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="en">English (Default)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Automated phone calls and diagnostic briefings will use this language.
              </p>
            </div>

            {/* Action */}
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="h-12 min-h-[44px] px-6 flex items-center justify-center gap-2 rounded-xl bg-[#ff5733] hover:bg-[#ff451d] text-white font-semibold text-sm shadow-md shadow-[#ff5733]/25 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff5733] focus:ring-offset-2"
              >
                <span>{loading ? "Saving…" : "Continue to Factory Setup"}</span>
                <ArrowRight className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
