import { cn } from "@/lib/utils";
import type { ChangeType } from "@/lib/types";

const typeStyles: Record<ChangeType, string> = {
  pricing: "bg-orange-500/10 text-orange-400",
  feature: "bg-blue-500/10 text-blue-400",
  messaging: "bg-purple-500/10 text-purple-400",
  hiring: "bg-cyan-500/10 text-cyan-400",
  content: "bg-slate-500/10 text-slate-400",
};

const typeLabels: Record<ChangeType, string> = {
  pricing: "Pricing",
  feature: "Feature",
  messaging: "Messaging",
  hiring: "Hiring",
  content: "Content",
};

interface ChangeTypeBadgeProps {
  type: ChangeType;
  className?: string;
}

export function ChangeTypeBadge({ type, className }: ChangeTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        typeStyles[type],
        className
      )}
    >
      {typeLabels[type]}
    </span>
  );
}
