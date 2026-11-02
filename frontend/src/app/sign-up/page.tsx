"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { setStoredToken, setStoredUser } from "@/lib/auth";
import type { TokenOut } from "@/types";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [agreeTerms, setAgreeTerms] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      errors.name = "Full name is required.";
    }

    if (!trimmedEmail) {
      errors.email = "Email is required.";
    } else if (!trimmedEmail.includes("@")) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 12) {
      errors.password = "Password must be at least 12 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const data = await apiClient.post<TokenOut>("/v1/auth/register", {
        full_name: trimmedName,
        email: trimmedEmail.toLowerCase(),
        password,
      });

      setStoredToken(data.access_token);
      setStoredUser({
        userId: data.user_id,
        email: data.email,
        fullName: trimmedName,
        role: data.role,
        onboardingCompleted: false,
        onboardingStep: 1,
      });

      router.push("/onboarding/personal");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_TAKEN") {
          setErrorMsg("An account with this email address already exists. Please sign in.");
        } else if (err.code === "RATE_LIMITED" || err.status === 429) {
          setErrorMsg("Too many attempts. Try again later.");
        } else if (err.code === "VALIDATION_ERROR") {
          setErrorMsg(err.message || "Invalid input. Please check the fields below.");
          if (err.details && typeof err.details === "object") {
            const serverErrors: Record<string, string> = {};
            for (const [key, val] of Object.entries(err.details)) {
              serverErrors[key === "full_name" ? "name" : key] = String(val);
            }
            setFieldErrors(serverErrors);
          }
        } else {
          setErrorMsg(err.message || "Account creation failed. Please try again.");
        }
      } else {
        setErrorMsg("Network error. Please verify your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#f7f7f8] px-4 py-12">
      <a className="skip-link" href="#sign-up-form">
        Skip to sign up
      </a>

      <main className="w-full max-w-[420px]">
        {/* Top Centered Squircle Badge with Concentric Ring */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#ff6b4a] to-[#ff4827] shadow-lg shadow-[#ff5733]/25 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-white"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle
                cx="14"
                cy="14"
                r="8"
                stroke="white"
                strokeWidth="3.5"
              />
            </svg>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="text-center mb-6">
          <h1
            id="sign-up-title"
            className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900"
          >
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-[320px] mx-auto leading-relaxed">
            You will set up your factory and machines next.
          </p>
        </div>

        {/* Social Connect Button */}
        <button
          type="button"
          onClick={() => {}}
          className="w-full h-11 min-h-[44px] flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs transition-all active:scale-[0.99] cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Connect with Facebook</span>
        </button>

        {/* Divider */}
        <div className="relative my-5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <span className="relative bg-[#f7f7f8] px-3 text-xs text-slate-400 font-normal">
            or sign up with email
          </span>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            id="sign-up-error"
            className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-sm font-medium text-rose-700"
            role="alert"
            data-testid="sign-up-error"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Form Container */}
        <form
          id="sign-up-form"
          className="space-y-4"
          noValidate
          data-testid="sign-up-form"
          onSubmit={handleSubmit}
        >
          {/* Full Name Field */}
          <div>
            <label
              htmlFor="su-name"
              className="block text-sm font-semibold text-slate-900 mb-1.5"
            >
              Full name
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-slate-400">
                <UserIcon className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="su-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                aria-describedby={fieldErrors.name ? "su-name-error" : undefined}
                aria-invalid={!!fieldErrors.name}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.name;
                      return next;
                    });
                  }
                }}
                placeholder="Anil Kumar"
                className="w-full h-11 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15 focus:outline-none transition-all"
              />
            </div>
            {fieldErrors.name && (
              <p id="su-name-error" className="mt-1 text-xs font-medium text-rose-600">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label
              htmlFor="su-email"
              className="block text-sm font-semibold text-slate-900 mb-1.5"
            >
              Work email
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="su-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                required
                aria-describedby={`su-email-hint${fieldErrors.email ? " su-email-error" : ""}`}
                aria-invalid={!!fieldErrors.email}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.email;
                      return next;
                    });
                  }
                }}
                placeholder="name@factory.com"
                className="w-full h-11 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15 focus:outline-none transition-all"
              />
            </div>
            <p id="su-email-hint" className="mt-1 text-xs text-slate-400">
              Used to sign in. We will not share it.
            </p>
            {fieldErrors.email && (
              <p id="su-email-error" className="mt-1 text-xs font-medium text-rose-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="su-password"
              className="block text-sm font-semibold text-slate-900 mb-1.5"
            >
              Password
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="su-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                aria-describedby={`su-password-hint${fieldErrors.password ? " su-password-error" : ""}`}
                aria-invalid={!!fieldErrors.password}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.password;
                      return next;
                    });
                  }
                }}
                placeholder="Enter at least 12 characters"
                className="w-full h-11 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15 focus:outline-none transition-all"
              />
              <button
                type="button"
                className="absolute right-2.5 h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#ff5733]"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <p id="su-password-hint" className="mt-1 text-xs text-slate-400">
              At least 12 characters.
            </p>
            {fieldErrors.password && (
              <p id="su-password-error" className="mt-1 text-xs font-medium text-rose-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Terms checkbox */}
          <div className="flex items-center gap-2 pt-0.5">
            <input
              id="agree-terms"
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#ff5733] focus:ring-[#ff5733]/30 cursor-pointer accent-[#ff5733]"
            />
            <label
              htmlFor="agree-terms"
              className="text-xs sm:text-sm text-slate-700 cursor-pointer select-none font-normal"
            >
              Agree to shop floor monitoring guidelines
            </label>
          </div>

          {/* Primary Coral Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 min-h-[44px] mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ff603e] to-[#ff4724] hover:from-[#f5522e] hover:to-[#e63c1a] text-white font-medium text-sm shadow-md shadow-[#ff5733]/25 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff5733] focus:ring-offset-2"
            data-testid="sign-up-submit"
          >
            <span>{loading ? "Creating account…" : "Create account"}</span>
            {!loading && <ArrowRight className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />}
          </button>
        </form>

        {/* Bottom Switch Link */}
        <p className="mt-8 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-[#ff5733] hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
