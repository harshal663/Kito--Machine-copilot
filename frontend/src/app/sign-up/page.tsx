"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radio, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api-client";
import { setStoredToken, setStoredUser } from "@/lib/auth";
import type { TokenOut } from "@/types";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }
    if (!email.trim() || !email.includes("@")) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (password.length < 10) {
      newErrors.password = "Password must be at least 10 characters long.";
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const data = await apiClient.post<TokenOut>("/v1/auth/register", {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      setStoredToken(data.access_token);
      setStoredUser({
        userId: data.user_id,
        email: data.email,
        fullName: fullName.trim(),
        role: data.role,
        onboardingCompleted: false,
        onboardingStep: 1,
      });

      router.push("/onboarding/personal");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_TAKEN") {
          setErrorMsg("An account with this email address already exists. Please sign in.");
        } else if (err.code === "VALIDATION_ERROR") {
          setErrorMsg(err.message || "Invalid input. Please check the fields below.");
          if (err.details && typeof err.details === "object") {
            const serverErrors: Record<string, string> = {};
            for (const [key, val] of Object.entries(err.details)) {
              serverErrors[key] = String(val);
            }
            setFieldErrors(serverErrors);
          }
        } else if (err.code === "RATE_LIMITED") {
          setErrorMsg("Too many attempts. Please try again later.");
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Radio className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Create an owner account
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start monitoring machine vibration and receiving proactive AI voice alerts
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Harshal Sharma"
              className="h-11 min-h-[44px]"
            />
            {fieldErrors.fullName && (
              <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@plant.example"
              className="h-11 min-h-[44px]"
            />
            {fieldErrors.email && (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="h-11 min-h-[44px]"
            />
            <p className="text-xs text-muted-foreground">
              Rule: Minimum 10 characters.
            </p>
            {fieldErrors.password && (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 min-h-[44px] text-base font-medium"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-primary hover:underline min-h-[44px] inline-flex items-center"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

