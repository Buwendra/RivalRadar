import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, Clock } from "lucide-react";

const stats = [
  {
    icon: AlertTriangle,
    stat: "68%",
    label: "of deals face competition",
    description: "Yet most teams only hear about competitor moves weeks later",
  },
  {
    icon: TrendingDown,
    stat: "3.8/10",
    label: "competitive preparedness",
    description: "Sales teams rate their competitive readiness below average",
  },
  {
    icon: Clock,
    stat: "$20K+/yr",
    label: "for enterprise CI tools",
    description: "Crayon, Klue, and similar tools are out of reach for SMBs",
  },
];

export function ProblemSection() {
  return (
    <section className="border-t border-brand-700 bg-brand-900/50 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            The competitive intelligence gap is{" "}
            <span className="text-significance-high">costing you deals</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Your competitors are changing their pricing, launching features, and
            shifting strategy every week. Are you the last to know?
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {stats.map((item) => (
            <Card key={item.label} className="border-brand-700 bg-brand-900">
              <CardContent className="p-6 text-center">
                <item.icon className="mx-auto h-8 w-8 text-significance-high" />
                <p className="mt-4 text-4xl font-bold">{item.stat}</p>
                <p className="mt-1 font-medium">{item.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
