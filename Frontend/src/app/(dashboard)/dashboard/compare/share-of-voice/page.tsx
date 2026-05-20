"use client";

/**
 * Phase 24 — Share of Voice page. Overall stacked bar at the top + per-category
 * grid below. Window selector clamps options to the user's tier
 * (Scout: 7d only, Strategist: 7d/30d, Command: 7d/30d/90d).
 */

import { useState } from "react";
import { useAuth } from "@/lib/auth/use-auth";
import { useShareOfVoice } from "@/lib/hooks/use-share-of-voice";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorAlert } from "@/components/shared/error-alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShareOfVoiceChart } from "@/components/dashboard/share-of-voice-chart";
import { PLAN_LIMITS } from "@/lib/utils/plan-limits";
import type { ResearchCategory, ShareOfVoiceWindowKey } from "@/lib/types";

const CATEGORY_LABELS: Record<ResearchCategory, string> = {
  news: "News",
  product: "Product",
  funding: "Funding",
  hiring: "Hiring",
  social: "Social",
};

const ALL_WINDOWS: Array<{ key: ShareOfVoiceWindowKey; days: number; label: string }> = [
  { key: "7d", days: 7, label: "Last 7 days" },
  { key: "30d", days: 30, label: "Last 30 days" },
  { key: "90d", days: 90, label: "Last 90 days" },
];

export default function ShareOfVoicePage() {
  const { user } = useAuth();
  const planCap = PLAN_LIMITS[user?.plan ?? "scout"].historyDays;
  const allowedWindows = ALL_WINDOWS.filter((w) => w.days <= planCap);
  const defaultWindow: ShareOfVoiceWindowKey =
    allowedWindows.find((w) => w.key === "30d")?.key ??
    allowedWindows[allowedWindows.length - 1]?.key ??
    "7d";
  const [windowKey, setWindowKey] = useState<ShareOfVoiceWindowKey>(defaultWindow);
  const { data, isLoading, isError, error, refetch } = useShareOfVoice(windowKey);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Share of Voice"
        description="How much coverage you and your competitors captured by category."
      >
        <Select
          value={windowKey}
          onValueChange={(v) => setWindowKey(v as ShareOfVoiceWindowKey)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedWindows.map((w) => (
              <SelectItem key={w.key} value={w.key}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {isError && (
        <ErrorAlert message={error?.message ?? "Unable to load share of voice."} onRetry={refetch} />
      )}

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full bg-brand-800" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 bg-brand-800" />
            ))}
          </div>
        </div>
      )}

      {data && (
        <>
          {data.totalChanges === 0 ? (
            <Card className="border-brand-700 bg-brand-900">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No tracked coverage in this window yet. Add competitors and run research to
                populate share of voice.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-brand-700 bg-brand-900">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Overall coverage</h2>
                    <span className="text-xs text-muted-foreground">
                      {data.totalChanges} mentions across the workspace
                    </span>
                  </div>
                  <ShareOfVoiceChart rows={data.overall} />
                </CardContent>
              </Card>

              <div>
                <h2 className="mb-3 text-sm font-semibold">By category</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(Object.keys(CATEGORY_LABELS) as ResearchCategory[]).map((cat) => (
                    <Card key={cat} className="border-brand-700 bg-brand-900">
                      <CardContent className="space-y-3 p-4">
                        <ShareOfVoiceChart
                          title={CATEGORY_LABELS[cat]}
                          rows={data.byCategory[cat] ?? []}
                          compact
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
