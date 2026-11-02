"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Radio, LogOut } from "lucide-react";
import { Stepper } from "@/components/shell/stepper";
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
    <div className="min-h-screen bg-[#f7f7f8] text-slate-900 flex flex-col">
      {/* Top minimal header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-[#ff4724] to-[#ff7347] shadow-sm shadow-[#ff5733]/20 ring-2 ring-[#ff5733]/15">
            <Radio className="h-5 w-5 text-white stroke-[2.2]" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-slate-900">
              Machine Copilot
            </span>
            <span className="ml-2 text-xs font-medium text-slate-400 hidden sm:inline">
              Owner Onboarding
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors min-h-[44px] cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
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
