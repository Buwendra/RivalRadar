"use client";

import { Lightbulb, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRecommendations } from "@/lib/hooks/use-recommendations";
import type { Recommendation } from "@/lib/types";
import { AiDisclaimer } from "./ai-disclaimer";
import { RecommendationRow } from "./recommendation-row";

export function RecommendationsCard() {
  const { data, isLoading } = useRecommendations({ status: "open" });
  const recs: Recommendation[] = (data?.pages ?? []).flatMap((p) => p.data);

  if (isLoading) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading recommendations…
        </CardContent>
      </Card>
    );
  }

  if (recs.length === 0) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended actions
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Recommendations appear after your weekly digest. They use this
            week&apos;s changes plus your company context to suggest 3–7
            strategic actions tagged by category, effort, and time horizon.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-cta" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended actions
            </h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {recs.length} open
          </Badge>
        </div>

        <ol className="space-y-3">
          {recs.map((r, idx) => (
            <RecommendationRow
              key={r.id}
              rec={r}
              index={idx}
              showIndex
              showActions
            />
          ))}
        </ol>

        <AiDisclaimer />
      </CardContent>
    </Card>
  );
}
