"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, FileText, Lightbulb, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSearch } from "@/lib/hooks/use-search";
import type { SearchResult } from "@/lib/types";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_ICON = {
  change: FileText,
  recommendation: Lightbulb,
  competitor: Building2,
} as const;

const TYPE_LABEL = {
  change: "Change",
  recommendation: "Recommendation",
  competitor: "Competitor",
} as const;

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data, isFetching, error } = useSearch(q);

  // Reset query when dialog closes so re-opening starts fresh.
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const handleSelect = (r: SearchResult) => {
    onOpenChange(false);
    if (r.type === "change") {
      router.push(`/dashboard/changes/${r.id}`);
    } else if (r.type === "competitor") {
      router.push(`/dashboard/competitors/${r.id}`);
    } else {
      // Recommendations don't have a dedicated detail page yet — land on the
      // dashboard where the recommendations card lives.
      router.push("/dashboard");
    }
  };

  const grouped = groupResults(data?.results ?? []);
  const showEmpty = q.trim().length >= 2 && !isFetching && (data?.results.length ?? 0) === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b border-brand-700 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search competitors, changes, recommendations…"
            className="border-0 bg-transparent px-0 focus-visible:ring-0"
          />
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {q.trim().length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </div>
          )}
          {error && (
            <div className="px-4 py-6 text-sm text-destructive">
              Search failed. Please try again.
            </div>
          )}
          {showEmpty && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matches for &ldquo;{q}&rdquo;.
            </div>
          )}
          {(["change", "recommendation", "competitor"] as const).map((type) => {
            const items = grouped[type];
            if (!items || items.length === 0) return null;
            return (
              <div key={type} className="border-b border-brand-700/60 last:border-0">
                <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {TYPE_LABEL[type]} ({items.length})
                </div>
                <ul>
                  {items.map((r) => {
                    const Icon = TYPE_ICON[r.type];
                    return (
                      <li key={`${r.type}-${r.id}`}>
                        <button
                          type="button"
                          onClick={() => handleSelect(r)}
                          className="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-brand-800"
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{r.title}</div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {r.snippet}
                            </div>
                            {r.competitorName && r.type !== "competitor" && (
                              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {r.competitorName}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {data?.truncated && (
            <div className="px-4 py-2 text-[10px] text-muted-foreground/70">
              Search scanned the most recent {data.totalScanned} records — refine the query for older items.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function groupResults(results: SearchResult[]): Record<SearchResult["type"], SearchResult[]> {
  return {
    change: results.filter((r) => r.type === "change"),
    recommendation: results.filter((r) => r.type === "recommendation"),
    competitor: results.filter((r) => r.type === "competitor"),
  };
}
