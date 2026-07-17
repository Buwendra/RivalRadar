import { Card, CardContent } from "@/components/ui/card";
import {
  Cpu,
  Sparkles,
  FileText,
  BarChart3,
  Users,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

const features = [
  {
    icon: Cpu,
    title: "AI-Powered Analysis",
    description:
      "Claude AI analyzes every change with structured insights — change type, significance score, strategic implications, and what the move means for your position, not just their headline.",
  },
  {
    icon: Sparkles,
    title: "Your Brand, Same Engine",
    description:
      "Brand Pulse runs the identical deep research on you — coverage, sentiment, share of voice — on every plan, so every competitor insight arrives with “and here's where you stand.”",
  },
  {
    icon: FileText,
    title: "Weekly Strategic Briefs",
    description:
      "Get a curated weekly digest of the moves that matter, with AI-generated strategic recommendations — plus an opt-in comparative brief on how you stack up against the field.",
  },
  {
    icon: BarChart3,
    title: "Significance Scoring",
    description:
      "Every change is scored 1-10 for significance. Focus on what matters — filter out the noise, act on the critical moves.",
  },
  {
    icon: Users,
    title: "Multi-Competitor Tracking",
    description:
      "Stay ahead of up to 25 competitors and see exactly where you stand against each — across news, product, funding, hiring, and social signals.",
  },
  {
    icon: Bell,
    title: "Same-Day Alerts",
    description:
      "When research detects a high-significance change (7+), an email lands the day we find it — so you know immediately whether you're exposed.",
  },
];

/* Decorative mini-visualizations (fictional data) shown inside each bento
   card. Indexed to match the `features` array above. */
function FeatureVisual({ index }: { index: number }) {
  switch (index) {
    case 0:
      // Mock analyzed finding
      return (
        <div className="rounded-lg border border-brand-700/60 bg-brand-950/50 p-3" aria-hidden>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
              Product
            </span>
            <span className="truncate text-muted-foreground">
              Acme Analytics · 2h ago
            </span>
            <span className="ml-auto shrink-0 rounded-full bg-significance-high/10 px-2 py-0.5 font-medium text-significance-high">
              8/10
            </span>
          </div>
          <p className="mt-2 text-sm">
            Launched usage-based pricing for their enterprise tier
          </p>
          <div className="mt-2 flex gap-1.5 text-xs">
            <span className="rounded-full bg-brand-800 px-2 py-0.5 text-muted-foreground">
              pricing-shift
            </span>
            <span className="rounded-full bg-brand-800 px-2 py-0.5 text-muted-foreground">
              going-upmarket
            </span>
          </div>
        </div>
      );
    case 1:
      // You vs. field mini bars
      return (
        <div className="space-y-2.5" aria-hidden>
          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs font-semibold text-emerald-400">
              You
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-800">
              <div className="h-full w-[62%] rounded-full bg-emerald-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-muted-foreground">
              Field avg.
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-800">
              <div className="h-full w-[41%] rounded-full bg-primary/60" />
            </div>
          </div>
        </div>
      );
    case 2:
      // Briefing skeleton lines
      return (
        <div className="rounded-lg border border-brand-700/60 bg-brand-950/50 p-3" aria-hidden>
          <div className="flex items-center justify-between">
            <div className="h-2.5 w-2/5 rounded bg-brand-700" />
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Mondays
            </span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-2 w-full rounded bg-brand-800" />
            <div className="h-2 w-5/6 rounded bg-brand-800" />
            <div className="h-2 w-4/6 rounded bg-brand-800" />
          </div>
        </div>
      );
    case 3:
      // 1-10 significance scale with a marker on 8
      return (
        <div aria-hidden>
          <div className="flex items-center gap-1">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2.5 flex-1 rounded-sm",
                  i < 5
                    ? "bg-significance-low/50"
                    : i < 7
                      ? "bg-significance-medium/60"
                      : "bg-significance-high/70",
                  i === 7 && "ring-2 ring-foreground/80"
                )}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>noise</span>
            <span>act now</span>
          </div>
        </div>
      );
    case 4:
      // Tracked-competitor avatar row
      return (
        <div className="flex items-center" aria-hidden>
          <div className="flex -space-x-2">
            {["A", "N", "B", "V", "S"].map((initial, i) => (
              <div
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-700 bg-brand-800 text-xs font-semibold"
              >
                {initial}
              </div>
            ))}
          </div>
          <span className="ml-3 text-xs text-muted-foreground">
            +20 more, ranked by threat
          </span>
        </div>
      );
    case 5:
      // Alert toast mock (rendered beside the text in the wide card)
      return (
        <div className="w-full shrink-0 rounded-lg border border-significance-high/30 bg-significance-high/5 p-4 shadow-lg shadow-significance-high/5 md:max-w-sm" aria-hidden>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4 text-significance-high" />
            High-significance change detected
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Northwind raised a $12M Series A — significance 9/10. Alert
            emailed the same day.
          </p>
        </div>
      );
    default:
      return null;
  }
}

/* Bento spans per feature index (3-column grid on lg) */
const spans = [
  "lg:col-span-2",
  "",
  "",
  "",
  "",
  "sm:col-span-2 lg:col-span-3",
];

export function FeaturesSection() {
  return (
    <section className="border-t border-brand-700 bg-brand-900/50 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to stay ahead
            </h2>
            <p className="mt-4 text-muted-foreground">
              Competitive intelligence and brand monitoring in one engine, at a price that makes sense for growing teams.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal
              key={feature.title}
              delay={(index % 3) * 100}
              className={spans[index]}
            >
              <Card className="group relative h-full overflow-hidden border-brand-700 bg-brand-900 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
                <CardContent
                  className={cn(
                    "p-6",
                    index === 5 &&
                      "flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
                  )}
                >
                  <div
                    className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    aria-hidden
                  />
                  <div>
                    <feature.icon className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                    <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                    {index !== 5 && (
                      <div className="mt-4">
                        <FeatureVisual index={index} />
                      </div>
                    )}
                  </div>
                  {index === 5 && <FeatureVisual index={index} />}
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
