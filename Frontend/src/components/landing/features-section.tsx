import { Card, CardContent } from "@/components/ui/card";
import {
  Cpu,
  Clock,
  FileText,
  BarChart3,
  Users,
  Bell,
} from "lucide-react";

const features = [
  {
    icon: Cpu,
    title: "AI-Powered Analysis",
    description:
      "Claude AI analyzes every change with structured insights — change type, significance score, strategic implications, and recommended actions.",
  },
  {
    icon: Clock,
    title: "Daily Monitoring",
    description:
      "Automated daily scraping of competitor websites. No manual checking needed — we catch every pricing, feature, and messaging change.",
  },
  {
    icon: FileText,
    title: "Weekly Strategic Briefs",
    description:
      "Get a curated weekly email digest with the most important changes, trends, and AI-generated strategic recommendations.",
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
      "Monitor up to 25 competitors at once. Track pricing pages, feature pages, blogs, careers, and homepages for a complete picture.",
  },
  {
    icon: Bell,
    title: "Real-Time Alerts",
    description:
      "Get instant email alerts when high-significance changes (7+) are detected. Never miss a competitor's major strategic move.",
  },
];

export function FeaturesSection() {
  return (
    <section className="border-t border-brand-700 bg-brand-900/50 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to stay ahead
          </h2>
          <p className="mt-4 text-muted-foreground">
            Enterprise-grade competitive intelligence at a price that makes sense for growing teams.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-brand-700 bg-brand-900">
              <CardContent className="p-6">
                <feature.icon className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
