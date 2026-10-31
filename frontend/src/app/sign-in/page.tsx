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
import type { TokenOut, User } from "@/types";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const data = await apiClient.post<TokenOut>("/v1/auth/login", {
        email,
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
        // If /v1/me fails, default to dashboard
      }

      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "RATE_LIMITED") {
          setErrorMsg("Too many failed attempts. Account temporarily locked for 15 minutes.");
        } else if (err.code === "UNAUTHENTICATED") {
          setErrorMsg("Invalid email or password.");
        } else {
          setErrorMsg(err.message || "Sign in failed. Please try again.");
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
            <Radio className="h-6 w-6 animate-pulse" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Sign in to Machine Copilot
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your factory owner credentials to monitor your shop floor
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
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
              className="h-11 min-h-[44px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="h-11 min-h-[44px]"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 min-h-[44px] text-base font-medium"
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account yet?{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-primary hover:underline min-h-[44px] inline-flex items-center"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

