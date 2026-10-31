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
  { id: 3, label: "Machines Setup", href: "/onboarding/machines" },
  { id: 4, label: "Review & Finish", href: "/onboarding/review" },
];

interface StepperProps {
  currentStep: number;
  className?: string;
}

export function Stepper({ currentStep, className }: StepperProps) {
  return (
    <nav aria-label="Onboarding Progress" className={cn("w-full py-4", className)}>
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
                  "after:content-[''] after:w-full after:h-0.5 after:bg-border after:inline-block after:absolute after:top-5 after:left-1/2 after:z-0",
                isCompleted && "after:bg-primary"
              )}
            >
              <Link
                href={isCompleted ? step.href : "#"}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "relative z-10 flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-full border-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  isCompleted &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                  isCurrent &&
                    "border-primary bg-background text-primary ring-4 ring-primary/20",
                  isUpcoming &&
                    "border-muted bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : <span>{step.id}</span>}
              </Link>
              <span
                className={cn(
                  "mt-2 text-xs font-medium text-center hidden sm:block",
                  isCurrent
                    ? "text-primary font-semibold"
                    : isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground"
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

