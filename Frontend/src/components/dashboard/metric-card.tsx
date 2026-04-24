"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricTone = "default" | "success" | "warning" | "destructive";

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: LucideIcon;
  tone?: MetricTone;
}

const TONE_STYLES: Record<MetricTone, string> = {
  default: "text-foreground",
  success: "text-emerald-400",
  warning: "text-amber-400",
  destructive: "text-red-400",
};

export function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "default",
}: MetricCardProps) {
  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {Icon && <Icon className={cn("h-4 w-4", TONE_STYLES[tone])} />}
        </div>
        <p className={cn("mt-2 text-2xl font-bold", TONE_STYLES[tone])}>{value}</p>
        {sublabel && (
          <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
