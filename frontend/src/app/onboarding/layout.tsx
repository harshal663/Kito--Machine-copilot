"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Radio, LogOut } from "lucide-react";
import { Stepper } from "@/components/shell/stepper";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { isAuthenticated, signOut } from "@/lib/auth";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/sign-in");
    }
  }, [router]);

  let currentStep = 1;
  if (pathname.includes("/factory")) currentStep = 2;
  else if (pathname.includes("/machines")) currentStep = 3;
  else if (pathname.includes("/review")) currentStep = 4;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top minimal header */}
      <header className="border-b border-border bg-card/80 backdrop-blur px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-foreground">
              Machine Copilot
            </span>
            <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
              Owner Onboarding
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="text-xs text-muted-foreground hover:text-foreground min-h-[44px]"
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            Sign out
          </Button>
        </div>
      </header>

      {/* Stepper progress */}
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:pt-8">
        <Stepper currentStep={currentStep} />
      </div>

      {/* Main onboarding card container */}
      <main className="flex-1 px-4 py-6 sm:py-8 flex justify-center">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}

