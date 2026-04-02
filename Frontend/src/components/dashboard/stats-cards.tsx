"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Users, Activity, AlertTriangle, TrendingUp } from "lucide-react";
import type { Competitor, Change } from "@/lib/types";

interface StatsCardsProps {
  competitors: Competitor[];
  changes: Change[];
}

export function StatsCards({ competitors, changes }: StatsCardsProps) {
  const activeCompetitors = competitors.filter((c) => c.status === "active").length;
  const highSignificance = changes.filter((c) => c.significance >= 7).length;
  const avgSignificance = changes.length > 0
    ? (changes.reduce((sum, c) => sum + c.significance, 0) / changes.length).toFixed(1)
    : "0";

  const stats = [
    {
      label: "Competitors",
      value: activeCompetitors,
      icon: Users,
      color: "text-primary",
    },
    {
      label: "Changes This Week",
      value: changes.length,
      icon: Activity,
      color: "text-significance-low",
    },
    {
      label: "High Priority",
      value: highSignificance,
      icon: AlertTriangle,
      color: "text-significance-high",
    },
    {
      label: "Avg. Significance",
      value: avgSignificance,
      icon: TrendingUp,
      color: "text-significance-medium",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-brand-700 bg-brand-900">
          <CardContent className="flex items-center gap-3 p-4">
            <stat.icon className={`h-8 w-8 ${stat.color}`} />
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
