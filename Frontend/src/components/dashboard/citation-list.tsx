"use client";

/**
 * Reusable list of source citations with quality flagging + dates.
 *
 * Extracted from research-card so the same rendering is shared by the research
 * card, the change-detail page, and the Brand Health card. Dedupes by URL
 * (with an ×N occurrence badge) and shows each source's date: the source's own
 * publication date when available, otherwise the date RivalScan accessed it
 * (labelled accordingly so we never imply a publish date we don't have).
 */

import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatSmartDate } from "@/lib/utils/format-date";
import { scoreSource, dedupeCitations, type SourceQuality } from "@/lib/utils/source-quality";
import type { Citation } from "@/lib/types";

const QUALITY_CLASS: Record<SourceQuality, string> = {
  high: "text-primary hover:underline font-medium",
  medium: "text-primary hover:underline",
  low: "text-primary/60 hover:underline opacity-70",
};

interface CitationListProps {
  citations: Citation[];
  /**
   * Competitor's own website URL — citations to this domain count as 'high'
   * source quality (their own announcement). Optional.
   */
  competitorUrl?: string;
  className?: string;
}

/** "published <date>" when the source exposed one, else "accessed <date>". */
function citationDate(c: Citation): { label: string; value: string } | null {
  if (c.publishedAt) return { label: "published", value: formatSmartDate(c.publishedAt) };
  if (c.accessedAt) return { label: "accessed", value: formatSmartDate(c.accessedAt) };
  return null;
}

export function CitationList({ citations, competitorUrl, className }: CitationListProps) {
  const deduped = dedupeCitations(citations);
  if (deduped.length === 0) return null;

  return (
    <ul className={cn("space-y-1.5", className)}>
      {deduped.map((citation) => {
        const quality = scoreSource(citation.url, competitorUrl);
        const date = citationDate(citation);
        return (
          <li key={citation.url} className="flex items-baseline gap-1.5 text-xs">
            {quality === "high" && (
              <ShieldCheck
                className="h-3 w-3 flex-shrink-0 text-emerald-400"
                aria-label="Reputable source"
              />
            )}
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("min-w-0 flex-1 truncate", QUALITY_CLASS[quality])}
              title={quality === "low" ? "Low-signal source — verify before relying on this" : undefined}
            >
              {citation.title}
            </a>
            {date && (
              <span className="flex-shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                {date.label} {date.value}
              </span>
            )}
            {citation.occurrences > 1 && (
              <Badge
                variant="outline"
                className="h-4 flex-shrink-0 px-1 text-[10px] tabular-nums"
              >
                ×{citation.occurrences}
              </Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}
