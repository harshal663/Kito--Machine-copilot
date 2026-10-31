"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getStoredUser } from "@/lib/auth";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/sign-in");
      return;
    }

    const user = getStoredUser();
    if (user && user.onboardingCompleted === false) {
      const stepRoutes: Record<number, string> = {
        1: "/onboarding/personal",
        2: "/onboarding/factory",
        3: "/onboarding/machines",
        4: "/onboarding/review",
      };
      router.replace(stepRoutes[user.onboardingStep || 1] || "/onboarding/personal");
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="animate-pulse text-sm text-muted-foreground">
        Loading Machine Copilot...
      </div>
    </div>
  );
}
