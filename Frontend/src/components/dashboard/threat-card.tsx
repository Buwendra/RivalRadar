"use client";

import { ShieldAlert, AlertTriangle, Eye, ShieldCheck, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ThreatLevel } from "@/lib/types";

const CONFIG: Record<
  ThreatLevel,
  {
    label: string;
    icon: typeof ShieldAlert;
    valueClass: string;
    iconClass: string;
    cardClass: string;
  }
> = {
  critical: {
    label: "Critical",
    icon: ShieldAlert,
    valueClass: "text-red-400",
    iconClass: "text-red-400",
    cardClass: "border-red-900/60 bg-red-950/30",
  },
  high: {
    label: "High",
    icon: AlertTriangle,
    valueClass: "text-orange-400",
    iconClass: "text-orange-400",
    cardClass: "border-orange-900/60 bg-orange-950/30",
  },
  medium: {
    label: "Medium",
    icon: Shield,
    valueClass: "text-amber-400",
    iconClass: "text-amber-400",
    cardClass: "border-brand-700 bg-brand-900",
  },
  low: {
    label: "Low",
    icon: ShieldCheck,
    valueClass: "text-emerald-400",
    iconClass: "text-emerald-400",
    cardClass: "border-brand-700 bg-brand-900",
  },
  monitor: {
    label: "Monitor",
    icon: Eye,
    valueClass: "text-muted-foreground",
    iconClass: "text-muted-foreground",
    cardClass: "border-brand-700 bg-brand-900",
  },
};

interface ThreatCardProps {
  threatLevel?: ThreatLevel;
  reasoning?: string;
}

export function ThreatCard({ threatLevel, reasoning }: ThreatCardProps) {
  if (!threatLevel) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Threat
            </span>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-muted-foreground">—</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            Run research at least once to score threat.
          </p>
        </CardContent>
      </Card>
    );
  }

  const cfg = CONFIG[threatLevel];
  const Icon = cfg.icon;

  return (
    <Card className={cn("border", cfg.cardClass)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Threat
          </span>
          <Icon className={cn("h-4 w-4", cfg.iconClass)} />
        </div>
        <p className={cn("mt-2 text-2xl font-bold", cfg.valueClass)}>
          {cfg.label}
        </p>
        {reasoning && (
          <p
            className="mt-1 line-clamp-2 text-xs text-muted-foreground"
            title={reasoning}
          >
            {reasoning}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
