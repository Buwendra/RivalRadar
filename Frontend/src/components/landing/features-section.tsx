import { Card, CardContent } from "@/components/ui/card";
import {
  Cpu,
  Sparkles,
  FileText,
  BarChart3,
  Users,
  Bell,
} from "lucide-react";
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
            <Reveal key={feature.title} delay={(index % 3) * 100}>
              <Card className="group relative h-full overflow-hidden border-brand-700 bg-brand-900 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
                <CardContent className="p-6">
                  <div
                    className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    aria-hidden
                  />
                  <feature.icon className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
