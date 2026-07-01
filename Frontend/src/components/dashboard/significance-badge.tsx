import { cn } from "@/lib/utils";
import { getSignificanceBgColor, getSignificanceLabel, getSignificanceDotColor } from "@/lib/utils/significance";
import { ScoreInfo } from "./score-info";

interface SignificanceBadgeProps {
  score: number;
  showLabel?: boolean;
  className?: string;
  /** Append the ⓘ "how is this calculated?" link (off by default to keep lists clean). */
  showInfo?: boolean;
}

export function SignificanceBadge({ score, showLabel = true, className, showInfo = false }: SignificanceBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1">
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
      {showInfo && <ScoreInfo metric="significance" />}
    </span>
  );
}
