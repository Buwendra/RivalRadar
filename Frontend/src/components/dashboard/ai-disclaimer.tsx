"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiDisclaimerProps {
  className?: string;
}

/**
 * Standardized footer shown beneath every AI-generated surface.
 *
 * Compliance basis:
 *   - Reduces commercial-libel exposure if Claude hallucinates a damaging
 *     claim about a competitor: the user is on notice that the output is
 *     AI-generated and may contain errors.
 *   - Discourages redistribution of AI output ("internal evaluation only").
 *   - Aligns with the AUP clause prohibiting use of output as legal/financial
 *     advice or as the basis for trading decisions.
 */
export function AiDisclaimer({ className }: AiDisclaimerProps) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 border-t border-brand-700/60 pt-2 text-[10px] leading-tight text-muted-foreground/70",
        className
      )}
    >
      <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
      <span>
        AI-generated analysis. May contain errors. For internal evaluation
        only — not legal or financial advice.
      </span>
    </p>
  );
}
