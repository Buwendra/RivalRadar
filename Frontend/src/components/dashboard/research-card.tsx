"use client";

import { ExternalLink, Newspaper, Package, DollarSign, Users, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatSmartDate } from "@/lib/utils/format-date";
import type { ResearchFinding, ResearchCategory, FindingItem } from "@/lib/types";
import { AiDisclaimer } from "./ai-disclaimer";

const CATEGORY_META: Record<ResearchCategory, { label: string; Icon: typeof Newspaper }> = {
  news: { label: "News & Press", Icon: Newspaper },
  product: { label: "Product Updates", Icon: Package },
  funding: { label: "Funding & Financials", Icon: DollarSign },
  hiring: { label: "Hiring & Leadership", Icon: Users },
  social: { label: "Social Activity", Icon: MessageCircle },
};

const IMPORTANCE_VARIANT: Record<1 | 2 | 3, "secondary" | "default" | "destructive"> = {
  1: "secondary",
  2: "default",
  3: "destructive",
};

interface ResearchCardProps {
  finding: ResearchFinding;
}

export function ResearchCard({ finding }: ResearchCardProps) {
  const totalFindings =
    finding.categories.news.length +
    finding.categories.product.length +
    finding.categories.funding.length +
    finding.categories.hiring.length +
    finding.categories.social.length;

  const nonEmptyCategories = (Object.keys(finding.categories) as ResearchCategory[]).filter(
    (cat) => finding.categories[cat].length > 0
  );

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

        {nonEmptyCategories.length > 0 && (
          <Accordion type="multiple" className="border-t border-brand-700">
            {nonEmptyCategories.map((cat) => (
              <CategorySection key={cat} category={cat} items={finding.categories[cat]} />
            ))}

            {finding.citations.length > 0 && (
              <AccordionItem value="citations" className="border-brand-700">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <span className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Sources ({finding.citations.length})
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-1 pt-1">
                    {finding.citations.map((citation) => (
                      <li key={citation.url} className="text-xs">
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {citation.title}
                        </a>
                      </li>
                    ))}
                  </ul>
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
}: {
  category: ResearchCategory;
  items: FindingItem[];
}) {
  const { label, Icon } = CATEGORY_META[category];
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
