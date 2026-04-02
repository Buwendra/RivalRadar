"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PAGE_TYPES } from "@/lib/utils/constants";
import type { PageType } from "@/lib/types";

interface StepPageTrackingProps {
  competitors: Array<{ name: string; url: string; pagesToTrack: PageType[] }>;
  onTogglePage: (competitorIndex: number, page: PageType) => void;
}

export function StepPageTracking({ competitors, onTogglePage }: StepPageTrackingProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Choose pages to monitor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select which pages to track for each competitor. We&apos;ll detect changes on these pages daily.
        </p>
      </div>

      <div className="space-y-6">
        {competitors.map((competitor, compIdx) => (
          <div key={compIdx} className="rounded-lg border border-brand-700 p-4">
            <h3 className="mb-3 font-medium">{competitor.name || `Competitor ${compIdx + 1}`}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PAGE_TYPES.map((pageType) => (
                <div key={pageType.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`${compIdx}-${pageType.value}`}
                    checked={competitor.pagesToTrack.includes(pageType.value as PageType)}
                    onCheckedChange={() => onTogglePage(compIdx, pageType.value as PageType)}
                  />
                  <Label
                    htmlFor={`${compIdx}-${pageType.value}`}
                    className="text-sm font-normal"
                  >
                    {pageType.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
