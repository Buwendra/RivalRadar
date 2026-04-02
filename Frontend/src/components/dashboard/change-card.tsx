"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SignificanceBadge } from "./significance-badge";
import { ChangeTypeBadge } from "./change-type-badge";
import { formatSmartDate } from "@/lib/utils/format-date";
import type { Change } from "@/lib/types";

interface ChangeCardProps {
  change: Change;
}

export function ChangeCard({ change }: ChangeCardProps) {
  return (
    <Link href={`/dashboard/changes/${change.id}`}>
      <Card className="border-brand-700 bg-brand-900 transition-colors hover:border-brand-600 hover:bg-brand-800">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {change.competitorName ?? "Unknown"}
                </span>
                <ChangeTypeBadge type={change.aiAnalysis.changeType} />
                <SignificanceBadge score={change.significance} />
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {change.aiAnalysis.summary}
              </p>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{formatSmartDate(change.detectedAt)}</span>
                <span className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {new URL(change.pageUrl).hostname}
                </span>
              </div>
            </div>

            <div className="flex-shrink-0 text-2xl font-bold text-muted-foreground">
              {change.significance}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
