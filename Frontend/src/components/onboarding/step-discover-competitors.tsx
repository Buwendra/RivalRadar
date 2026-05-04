"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { onboardingApi, type SuggestedCompetitor } from "@/lib/api/onboarding";
import { ApiClientError } from "@/lib/api/client";

interface StepDiscoverCompetitorsProps {
  companyName: string;
  industry: string;
  companyUrl: string;
  onCompanyUrlChange: (value: string) => void;
  onApply: (selected: SuggestedCompetitor[]) => void;
  onSkip: () => void;
}

const CONFIDENCE_TONE: Record<SuggestedCompetitor["confidence"], string> = {
  high: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  medium: "border-brand-700 bg-brand-800 text-foreground",
  low: "border-amber-900/60 bg-amber-950/40 text-amber-300",
};

export function StepDiscoverCompetitors({
  companyName,
  industry,
  companyUrl,
  onCompanyUrlChange,
  onApply,
  onSkip,
}: StepDiscoverCompetitorsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedCompetitor[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleFind = async () => {
    if (!companyUrl.trim()) {
      toast.error("Please enter your website URL first");
      return;
    }
    setIsLoading(true);
    try {
      const result = await onboardingApi.suggestCompetitors({
        companyName,
        companyUrl: companyUrl.trim(),
        industry,
      });
      const list = result.suggestions ?? [];
      setSuggestions(list);
      setSelected(new Set(list.map((s) => s.url)));
      if (list.length === 0) {
        toast.info(
          "We couldn't find specific competitors. You can add them manually on the next step."
        );
      } else {
        toast.success(`Found ${list.length} potential competitors`);
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Couldn't fetch suggestions";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleApply = () => {
    const picked = suggestions.filter((s) => selected.has(s.url));
    if (picked.length === 0) {
      toast.error("Pick at least one competitor or skip this step");
      return;
    }
    onApply(picked);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Find your competitors</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste your website URL and we&apos;ll suggest competitors to track. You can
          edit, add, or remove any of them on the next step.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyUrl">Your website</Label>
        <div className="flex items-stretch gap-2">
          <Input
            id="companyUrl"
            type="url"
            value={companyUrl}
            onChange={(e) => onCompanyUrlChange(e.target.value)}
            placeholder="https://acme.com"
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            type="button"
            onClick={handleFind}
            disabled={isLoading || !companyUrl.trim()}
            className="bg-cta text-brand-950 hover:bg-cta-hover"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Finding…" : "Find competitors"}
          </Button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              We found {suggestions.length} potential competitors. Uncheck any you
              don&apos;t want to track.
            </p>
            <Badge variant="outline" className="text-xs">
              {selected.size}/{suggestions.length} selected
            </Badge>
          </div>
          <ul className="space-y-2">
            {suggestions.map((s) => {
              const isSelected = selected.has(s.url);
              return (
                <li
                  key={s.url}
                  className={cn(
                    "rounded-md border p-3 transition-colors",
                    isSelected
                      ? "border-brand-700 bg-brand-950/40"
                      : "border-brand-700/40 bg-brand-950/20 opacity-60"
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(s.url)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-medium">{s.name}</span>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                        >
                          {s.url.replace(/^https?:\/\//, "")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 px-1.5 text-[10px] font-medium",
                            CONFIDENCE_TONE[s.confidence]
                          )}
                        >
                          {s.confidence === "high"
                            ? "High match"
                            : s.confidence === "medium"
                            ? "Possible match"
                            : "Speculative"}
                        </Badge>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {s.rationale}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Skip — I&apos;ll add manually
            </button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={selected.size === 0}
            >
              <Check className="mr-2 h-4 w-4" />
              Apply {selected.size} competitor{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {suggestions.length === 0 && !isLoading && (
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Skip — I&apos;ll add competitors manually
        </button>
      )}
    </div>
  );
}
