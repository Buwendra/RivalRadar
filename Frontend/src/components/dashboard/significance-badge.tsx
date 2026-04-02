import { cn } from "@/lib/utils";
import { getSignificanceBgColor, getSignificanceLabel, getSignificanceDotColor } from "@/lib/utils/significance";

interface SignificanceBadgeProps {
  score: number;
  showLabel?: boolean;
  className?: string;
}

export function SignificanceBadge({ score, showLabel = true, className }: SignificanceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        getSignificanceBgColor(score),
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", getSignificanceDotColor(score))} />
      {showLabel ? getSignificanceLabel(score) : score}
    </span>
  );
}
