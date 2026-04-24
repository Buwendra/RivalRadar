"use client";

import { Progress } from "@/components/ui/progress";
import type { PageType } from "@/lib/types";

interface PageActivityListProps {
  pagesToTrack: PageType[];
  changesByPage: Partial<Record<PageType, number>>;
  onPageClick?: (page: PageType) => void;
}

const PAGE_LABELS: Record<PageType, string> = {
  pricing: "Pricing",
  features: "Features",
  homepage: "Homepage",
  blog: "Blog",
  careers: "Careers",
};

export function PageActivityList({
  pagesToTrack,
  changesByPage,
  onPageClick,
}: PageActivityListProps) {
  const max = Math.max(
    1,
    ...pagesToTrack.map((p) => changesByPage[p] ?? 0)
  );

  return (
    <ul className="space-y-3">
      {pagesToTrack.map((page) => {
        const count = changesByPage[page] ?? 0;
        const percent = Math.round((count / max) * 100);
        const content = (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{PAGE_LABELS[page]}</span>
              <span className="tabular-nums text-muted-foreground">
                {count} change{count === 1 ? "" : "s"}
              </span>
            </div>
            <Progress value={percent} className="mt-1.5 h-2" />
          </>
        );

        return (
          <li key={page}>
            {onPageClick ? (
              <button
                type="button"
                onClick={() => onPageClick(page)}
                className="w-full rounded-md p-2 text-left transition-colors hover:bg-brand-800"
              >
                {content}
              </button>
            ) : (
              <div className="p-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
