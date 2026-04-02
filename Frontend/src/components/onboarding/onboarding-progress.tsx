"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface OnboardingProgressProps {
  currentStep: number;
  steps: string[];
}

export function OnboardingProgress({ currentStep, steps }: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
              index < currentStep
                ? "bg-primary text-primary-foreground"
                : index === currentStep
                ? "border-2 border-primary text-primary"
                : "border border-brand-700 text-muted-foreground"
            )}
          >
            {index < currentStep ? (
              <Check className="h-4 w-4" />
            ) : (
              index + 1
            )}
          </div>
          <span
            className={cn(
              "hidden text-sm sm:inline",
              index === currentStep ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-8 sm:w-12",
                index < currentStep ? "bg-primary" : "bg-brand-700"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
