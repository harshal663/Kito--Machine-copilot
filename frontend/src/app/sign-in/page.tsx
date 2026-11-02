"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { setStoredToken, setStoredUser } from "@/lib/auth";
import type { TokenOut, User } from "@/types";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = "Email is required.";
    } else if (!trimmedEmail.includes("@")) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const data = await apiClient.post<TokenOut>("/v1/auth/login", {
        email: trimmedEmail.toLowerCase(),
        password,
      });

      setStoredToken(data.access_token);
      setStoredUser({
        userId: data.user_id,
        email: data.email,
        role: data.role,
      });

      // Check onboarding status
      try {
        const user = await apiClient.get<User>("/v1/me");
        setStoredUser({
          userId: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          onboardingCompleted: user.onboarding_completed,
          onboardingStep: user.onboarding_step,
        });

        if (!user.onboarding_completed) {
          const stepRoutes: Record<number, string> = {
            1: "/onboarding/personal",
            2: "/onboarding/factory",
            3: "/onboarding/machines",
            4: "/onboarding/review",
          };
          router.push(stepRoutes[user.onboarding_step] || "/onboarding/personal");
          return;
        }
      } catch {
        // If /v1/me fails, continue to dashboard
      }

      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "RATE_LIMITED" || err.status === 429) {
          setErrorMsg("Too many attempts. Try again later.");
        } else if (err.code === "UNAUTHENTICATED" || err.status === 401) {
          setErrorMsg("Email or password is incorrect.");
        } else {
          setErrorMsg(err.message || "Email or password is incorrect.");
        }
      } else {
        setErrorMsg("Email or password is incorrect.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#f7f7f8] px-4 py-12">
      <a className="skip-link" href="#sign-in-form">
        Skip to sign in
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
            id="sign-in-title"
            aria-label="Sign in"
            className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900"
          >
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-[320px] mx-auto leading-relaxed">
            Sign in to access to your dashboard, settings and projects.
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
            or sign in with email
          </span>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            id="sign-in-error"
            className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-sm font-medium text-rose-700"
            role="alert"
            data-testid="sign-in-error"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Form Container */}
        <form
          id="sign-in-form"
          className="space-y-4"
          noValidate
          data-testid="sign-in-form"
          onSubmit={handleSubmit}
        >
          {/* Email Field */}
          <div>
            <label
              htmlFor="si-email"
              className="block text-sm font-semibold text-slate-900 mb-1.5"
            >
              Email
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="si-email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                spellCheck={false}
                required
                aria-describedby={fieldErrors.email ? "si-email-error" : undefined}
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
                placeholder="info@pixsellz.io"
                className="w-full h-11 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15 focus:outline-none transition-all"
              />
            </div>
            {fieldErrors.email && (
              <p id="si-email-error" className="mt-1 text-xs font-medium text-rose-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password Field with Forgot Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="si-password"
                className="text-sm font-semibold text-slate-900"
              >
                Password
              </label>
              <button
                type="button"
                className="text-xs font-normal text-[#ff6a4a] hover:text-[#ff5733] hover:underline transition-colors focus:outline-none focus:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="si-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                aria-describedby={fieldErrors.password ? "si-password-error" : undefined}
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
                placeholder="Enter your password"
                className="w-full h-11 min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-[#ff6849] focus:ring-4 focus:ring-[#ff5733]/15 focus:outline-none transition-all"
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
            {fieldErrors.password && (
              <p id="si-password-error" className="mt-1 text-xs font-medium text-rose-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Remember for 30 days */}
          <div className="flex items-center gap-2 pt-0.5">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#ff5733] focus:ring-[#ff5733]/30 cursor-pointer accent-[#ff5733]"
            />
            <label
              htmlFor="remember"
              className="text-xs sm:text-sm text-slate-700 cursor-pointer select-none font-normal"
            >
              Remember for 30 days
            </label>
          </div>

          {/* Primary Coral Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 min-h-[44px] mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ff603e] to-[#ff4724] hover:from-[#f5522e] hover:to-[#e63c1a] text-white font-medium text-sm shadow-md shadow-[#ff5733]/25 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff5733] focus:ring-offset-2"
            data-testid="sign-in-submit"
          >
            <span>{loading ? "Signing in…" : "Sign in"}</span>
            {!loading && <ArrowRight className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />}
          </button>
        </form>

        {/* Bottom Switch Link */}
        <p className="mt-8 text-center text-sm text-slate-500">
          No account?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-[#ff5733] hover:underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      </main>
    </div>
  );
}
