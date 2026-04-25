"use client";

import { TrendingUp, TrendingDown, Minus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Momentum } from "@/lib/types";

const CONFIG: Record<
  Momentum,
  {
    label: string;
    icon: typeof TrendingUp;
    className: string;
    showPercent: boolean;
  }
> = {
  rising: {
    label: "Rising",
    icon: TrendingUp,
    className: "bg-emerald-950 text-emerald-300 border-emerald-700",
    showPercent: true,
  },
  stable: {
    label: "Stable",
    icon: Minus,
    className: "bg-brand-800 text-muted-foreground border-brand-700",
    showPercent: true,
  },
  slowing: {
    label: "Slowing",
    icon: TrendingDown,
    className: "bg-amber-950 text-amber-300 border-amber-700",
    showPercent: true,
  },
  declining: {
    label: "Declining",
    icon: TrendingDown,
    className: "bg-red-950 text-red-300 border-red-700",
    showPercent: true,
  },
  "insufficient-data": {
    label: "Insufficient data",
    icon: MoreHorizontal,
    className: "bg-brand-800 text-muted-foreground border-brand-700",
    showPercent: false,
  },
};

interface MomentumChipProps {
  momentum?: Momentum;
  momentumChangePercent?: number;
  size?: "sm" | "md";
  className?: string;
}

function formatPercent(pct: number): string {
  if (pct >= 999) return "+999%+";
  const rounded = Math.round(pct);
  return rounded >= 0 ? `+${rounded}%` : `${rounded}%`;
}

export function MomentumChip({
  momentum,
  momentumChangePercent,
  size = "md",
  className,
}: MomentumChipProps) {
  const cfg = CONFIG[momentum ?? "insufficient-data"];
  const Icon = cfg.icon;

  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const padding = size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-xs";

  const showPct =
    cfg.showPercent && typeof momentumChangePercent === "number";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        padding,
        cfg.className,
        className
      )}
      title={
        showPct
          ? `${cfg.label} — 7-day change: ${formatPercent(momentumChangePercent!)}`
          : cfg.label
      }
    >
      <Icon className={iconSize} />
      <span>{cfg.label}</span>
      {showPct && (
        <span className="tabular-nums opacity-80">
          · {formatPercent(momentumChangePercent!)}
        </span>
      )}
    </span>
  );
}
