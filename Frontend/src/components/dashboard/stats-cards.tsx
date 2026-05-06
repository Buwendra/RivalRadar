"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Activity,
  AlertTriangle,
  TrendingUp,
  Plus,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Competitor, Change } from "@/lib/types";

interface StatsCardsProps {
  competitors: Competitor[];
  changes: Change[];
  onAddCompetitor?: () => void;
  onBulkImport?: () => void;
}

export function StatsCards({
  competitors,
  changes,
  onAddCompetitor,
  onBulkImport,
}: StatsCardsProps) {
  // Empty-state CTA replaces the four-zeros grid for fresh accounts.
  if (competitors.length === 0) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <Users className="h-10 w-10 text-primary" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Add your first competitor</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Start tracking who you&apos;re up against. Add one competitor at a
              time, or bulk-import 10+ at once via CSV.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onAddCompetitor && (
              <Button onClick={onAddCompetitor}>
                <Plus className="mr-2 h-4 w-4" /> Add Competitor
              </Button>
            )}
            {onBulkImport && (
              <Button variant="outline" onClick={onBulkImport}>
                <Upload className="mr-2 h-4 w-4" /> Bulk import (CSV)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

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
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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
