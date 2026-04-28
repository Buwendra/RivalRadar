"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone =
  | "default"
  | "destructive"
  | "warning"
  | "success"
  | "outline"
  | "muted";

interface TagSpec {
  label: string;
  description: string;
  tone: Tone;
}

const TAG_CONFIG: Record<string, TagSpec> = {
  // Concerns — red
  "runway-low": {
    label: "Runway low",
    description: "Funding-state signals suggest cash concerns.",
    tone: "destructive",
  },
  layoffs: {
    label: "Layoffs",
    description: "Recent layoffs detected in research findings.",
    tone: "destructive",
  },
  "shipping-frozen": {
    label: "Shipping frozen",
    description: "No detectable product shipping activity recently.",
    tone: "destructive",
  },
  "hiring-frozen": {
    label: "Hiring frozen",
    description: "Hiring has stalled — no new postings or hires detected.",
    tone: "destructive",
  },
  "declining-stage": {
    label: "Declining",
    description: "The company appears to be contracting.",
    tone: "destructive",
  },

  // Funding events — amber
  "just-raised": {
    label: "Just raised",
    description:
      "Recently closed a funding round (confirmed by both research state and a recent funding-category change).",
    tone: "warning",
  },
  "actively-raising": {
    label: "Raising",
    description: "Signals indicate they are actively pursuing a funding round.",
    tone: "warning",
  },

  // Stage / funding state — neutral grey
  "early-stage": {
    label: "Early stage",
    description: "Pre-product-market-fit or seed-stage signals.",
    tone: "default",
  },
  "growth-stage": {
    label: "Growth stage",
    description: "Scaling rapidly post-PMF.",
    tone: "default",
  },
  "late-stage": {
    label: "Late stage",
    description: "Established player, late-stage private or pre-IPO.",
    tone: "default",
  },
  "public-co": {
    label: "Public",
    description: "Publicly traded company.",
    tone: "default",
  },
  bootstrapped: {
    label: "Bootstrapped",
    description: "Self-funded, no significant outside capital detected.",
    tone: "default",
  },

  // Hiring — emerald (positive signal of growth)
  "hiring-aggressively": {
    label: "Hiring fast",
    description: "Visibly aggressive hiring — strong scaling signal.",
    tone: "success",
  },

  // Strategy direction — outline (neutral context)
  "going-upmarket": {
    label: "Going upmarket",
    description: "Targeting larger / enterprise customers.",
    tone: "outline",
  },
  "going-downmarket": {
    label: "Going downmarket",
    description: "Targeting smaller customers or self-serve.",
    tone: "outline",
  },
  "expanding-geo": {
    label: "Expanding geo",
    description: "Visible signals of new geographic expansion.",
    tone: "outline",
  },
  "expanding-vertical": {
    label: "Expanding vertical",
    description: "Adding new industry verticals to their offering.",
    tone: "outline",
  },
  specializing: {
    label: "Specializing",
    description: "Narrowing focus to a specific use case or segment.",
    tone: "outline",
  },
  diversifying: {
    label: "Diversifying",
    description: "Broadening into adjacent products or markets.",
    tone: "outline",
  },

  // Tech positioning — outline
  "ai-native": {
    label: "AI-native",
    description: "AI is core to the product, not bolted on.",
    tone: "outline",
  },
  "open-source": {
    label: "Open source",
    description: "Open-source product or core.",
    tone: "outline",
  },

  // Pacing — emerald
  "shipping-fast": {
    label: "Shipping fast",
    description: "Frequent product releases and updates detected.",
    tone: "success",
  },

  // Triage — muted
  deprioritize: {
    label: "Deprioritize",
    description:
      "Both threat and momentum suggest this competitor warrants minimal attention.",
    tone: "muted",
  },
};

const TONE_CLASS: Record<Tone, string> = {
  default: "border-brand-700 bg-brand-800 text-foreground",
  destructive: "border-red-900/60 bg-red-950/40 text-red-300",
  warning: "border-amber-900/60 bg-amber-950/40 text-amber-300",
  success: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
  outline: "border-brand-700 bg-transparent text-muted-foreground",
  muted: "border-brand-800 bg-brand-900 text-muted-foreground/70",
};

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

interface CompetitorTagChipsProps {
  tags?: string[];
}

export function CompetitorTagChips({ tags }: CompetitorTagChipsProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((slug) => {
        const cfg = TAG_CONFIG[slug];
        const label = cfg?.label ?? humanize(slug);
        const description = cfg?.description ?? label;
        const tone: Tone = cfg?.tone ?? "default";
        return (
          <Badge
            key={slug}
            variant="outline"
            className={cn("h-6 border px-2 text-xs font-medium", TONE_CLASS[tone])}
            title={description}
          >
            {label}
          </Badge>
        );
      })}
    </div>
  );
}
