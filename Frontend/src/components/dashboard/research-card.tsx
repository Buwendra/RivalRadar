"use client";

import { ExternalLink, Newspaper, Package, DollarSign, Users, MessageCircle, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatSmartDate } from "@/lib/utils/format-date";
import { dedupeCitations } from "@/lib/utils/source-quality";
import type { ResearchFinding, ResearchCategory, FindingItem, Citation } from "@/lib/types";
import { AiDisclaimer } from "./ai-disclaimer";
import { CitationList } from "./citation-list";

// Static metadata for the 5 base categories. `industryContext` is resolved
// at render time because its label is per-user-industry (carried on the
// finding as `industryContextLabel`).
const STATIC_CATEGORY_META: Partial<
  Record<ResearchCategory, { label: string; Icon: typeof Newspaper }>
> = {
  news: { label: "News & Press", Icon: Newspaper },
  product: { label: "Product Updates", Icon: Package },
  funding: { label: "Funding & Financials", Icon: DollarSign },
  hiring: { label: "Hiring & Leadership", Icon: Users },
  social: { label: "Social Activity", Icon: MessageCircle },
};

function resolveCategoryMeta(
  category: ResearchCategory,
  finding: ResearchFinding
): { label: string; Icon: typeof Newspaper } {
  if (category === "industryContext") {
    return {
      label: finding.industryContextLabel ?? "Industry Context",
      Icon: Building2,
    };
  }
  // STATIC_CATEGORY_META covers the other 5 keys today, but the data comes
  // from stored rows — a category outside the current union must degrade to
  // a generic section, not crash the card on a non-null assertion.
  return STATIC_CATEGORY_META[category] ?? { label: category, Icon: Newspaper };
}

const IMPORTANCE_VARIANT: Record<1 | 2 | 3, "secondary" | "default" | "destructive"> = {
  1: "secondary",
  2: "default",
  3: "destructive",
};

interface ResearchCardProps {
  finding: ResearchFinding;
  /**
   * Competitor's own website URL — citations to this domain count as 'high'
   * source quality (their own announcement). Optional — when absent, the
   * first-party rule is skipped.
   */
  competitorUrl?: string;
}

export function ResearchCard({ finding, competitorUrl }: ResearchCardProps) {
  // Object.values keeps this stable as the ResearchCategory union grows
  // (today: the 6th `industryContext` bucket).
  const totalFindings = Object.values(finding.categories).reduce(
    (n, arr) => n + arr.length,
    0
  );

  const nonEmptyCategories = (Object.keys(finding.categories) as ResearchCategory[]).filter(
    (cat) => finding.categories[cat].length > 0
  );

  // Dedupe citations across categories — the same URL often appears in
  // multiple findings (e.g. a single TechCrunch article cited from both
  // "news" and "funding"). Show once with a count badge instead.
  const dedupedCitations = dedupeCitations(finding.citations as Citation[]);

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Deep Research
            </h3>
            <p className="text-xs text-muted-foreground">
              Generated {formatSmartDate(finding.generatedAt)} ·{" "}
              {totalFindings} finding{totalFindings === 1 ? "" : "s"} ·{" "}
              {finding.citations.length} source{finding.citations.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed">{finding.summary}</p>

        {/* Sources render whenever citations exist — a finding with zero
            category items but N citations used to advertise "· N sources" in
            the header with no way to open them. */}
        {(nonEmptyCategories.length > 0 || dedupedCitations.length > 0) && (
          <Accordion type="multiple" className="border-t border-brand-700">
            {nonEmptyCategories.map((cat) => (
              <CategorySection
                key={cat}
                category={cat}
                items={finding.categories[cat]}
                meta={resolveCategoryMeta(cat, finding)}
              />
            ))}

            {dedupedCitations.length > 0 && (
              <AccordionItem value="citations" className="border-brand-700">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <span className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Sources ({dedupedCitations.length})
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <CitationList
                    citations={finding.citations as Citation[]}
                    competitorUrl={competitorUrl}
                    className="pt-1"
                  />
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
        <AiDisclaimer />
      </CardContent>
    </Card>
  );
}

function CategorySection({
  category,
  items,
  meta,
}: {
  category: ResearchCategory;
  items: FindingItem[];
  meta: { label: string; Icon: typeof Newspaper };
}) {
  const { label, Icon } = meta;
  return (
    <AccordionItem value={category} className="border-brand-700">
      <AccordionTrigger className="text-sm hover:no-underline">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {label}
          <Badge variant="outline" className="ml-1 text-xs">
            {items.length}
          </Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <ul className="space-y-3 pt-1">
          {items.map((item, idx) => (
            <li key={`${category}-${idx}`} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{item.title}</span>
                <Badge variant={IMPORTANCE_VARIANT[item.importance]} className="text-xs">
                  {importanceLabel(item.importance)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Source
                </a>
              )}
            </li>
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}

function importanceLabel(level: 1 | 2 | 3): string {
  if (level === 3) return "Strategic";
  if (level === 2) return "Notable";
  return "Minor";
}
