"use client";

/**
 * Phase 2 demo-wow — audio briefing card on the dashboard. Renders a native
 * <audio> element for the latest weekly briefing on Strategist+ accounts;
 * shows an upgrade CTA on Scout.
 *
 * The URL comes from `user.audioBriefing.url` (populated by the profile GET
 * handler from the most recent `AUDIO#` row, with a fresh presigned URL
 * minted on the fly when the stored one is near expiry).
 */

import Link from "next/link";
import { Headphones, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/use-auth";
import { useCapability } from "@/lib/hooks/use-capability";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatSmartDate } from "@/lib/utils/format-date";

function formatDuration(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function AudioBriefingCard() {
  const { user } = useAuth();
  const hasAudioBriefing = useCapability("audioBriefing");
  const briefing = user?.audioBriefing;

  // Scout — show a small upgrade CTA so the feature shapes the upgrade narrative
  // without taking up a lot of real estate.
  if (!hasAudioBriefing) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-md bg-brand-800 p-2">
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-sm font-medium">Audio briefing</h3>
              <Badge variant="outline" className="text-[10px]">
                Strategist+
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Listen to your weekly briefing on the go. Available on Strategist
              and Command plans.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href="/dashboard/settings/billing">Upgrade</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No briefing yet — first week of subscription, or pipeline hasn't run.
  if (!briefing) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-md bg-brand-800 p-2">
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">Audio briefing</h3>
            <p className="text-xs text-muted-foreground">
              Your first audio briefing will be ready after the next weekly
              digest (Monday 8am UTC).
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">This week&apos;s briefing</h3>
            <Badge variant="outline" className="text-[10px]">
              {formatDuration(briefing.durationSec)}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatSmartDate(briefing.generatedAt)}
          </span>
        </div>
        <audio controls preload="none" className="w-full" src={briefing.url}>
          Your browser does not support the audio element.
          <a href={briefing.url}>Download the briefing</a>
        </audio>
        <p className="text-xs text-muted-foreground">
          Narrated by RivalScan. Tap play, or download to listen on the go.
        </p>
      </CardContent>
    </Card>
  );
}
