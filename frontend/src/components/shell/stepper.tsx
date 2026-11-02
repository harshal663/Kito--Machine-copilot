import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepItem {
  id: number;
  label: string;
  href: string;
}

export const ONBOARDING_STEPS: StepItem[] = [
  { id: 1, label: "Personal Details", href: "/onboarding/personal" },
  { id: 2, label: "Factory Details", href: "/onboarding/factory" },
  { id: 3, label: "Machinery Setup", href: "/onboarding/machines" },
  { id: 4, label: "Review & Finish", href: "/onboarding/review" },
];

interface StepperProps {
  currentStep: number;
  className?: string;
}

export function Stepper({ currentStep, className }: StepperProps) {
  return (
    <nav aria-label="Onboarding Progress" className={cn("w-full py-2", className)}>
      <ol className="flex items-center justify-between w-full">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isUpcoming = step.id > currentStep;

          return (
            <li
              key={step.id}
              className={cn(
                "relative flex-1 flex flex-col items-center",
                idx !== ONBOARDING_STEPS.length - 1 &&
                  "after:content-[''] after:w-full after:h-0.5 after:bg-slate-200 after:inline-block after:absolute after:top-5 after:left-1/2 after:z-0",
                isCompleted && "after:bg-[#ff5733]"
              )}
            >
              <Link
                href={isCompleted ? step.href : "#"}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "relative z-10 flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[#ff5733] focus:ring-offset-2",
                  isCompleted &&
                    "bg-[#ff5733] text-white shadow-sm shadow-[#ff5733]/30",
                  isCurrent &&
                    "border-2 border-[#ff5733] bg-white text-[#ff5733] ring-4 ring-[#ff5733]/15 shadow-sm",
                  isUpcoming &&
                    "border border-slate-200 bg-white text-slate-400 cursor-not-allowed"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4 stroke-[2.5]" /> : <span>{step.id}</span>}
              </Link>
              <span
                className={cn(
                  "mt-2 text-xs font-semibold text-center hidden sm:block transition-colors",
                  isCurrent
                    ? "text-[#ff5733]"
                    : isCompleted
                    ? "text-slate-800"
                    : "text-slate-400"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
