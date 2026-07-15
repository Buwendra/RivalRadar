import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, Clock } from "lucide-react";
import { CountUp } from "./count-up";
import { Reveal } from "./reveal";

const stats = [
  {
    icon: AlertTriangle,
    value: 68,
    suffix: "%",
    decimals: 0,
    prefix: "",
    label: "of deals face competition",
    description: "Yet most teams only hear about competitor moves weeks later",
  },
  {
    icon: TrendingDown,
    value: 3.8,
    suffix: "/10",
    decimals: 1,
    prefix: "",
    label: "competitive preparedness",
    description: "Sales teams rate their competitive readiness below average",
  },
  {
    icon: Clock,
    value: 20,
    suffix: "K+/yr",
    decimals: 0,
    prefix: "$",
    label: "for enterprise CI tools",
    description: "Crayon, Klue, and similar tools are out of reach for SMBs",
  },
];

export function ProblemSection() {
  return (
    <section className="border-t border-brand-700 bg-brand-900/50 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The competitive intelligence gap is{" "}
              <span className="text-significance-high">costing you deals</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Your competitors are changing their pricing, launching features, and
              shifting strategy every week. Do you know where you stand?
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {stats.map((item, index) => (
            <Reveal key={item.label} delay={index * 120}>
              <Card className="group border-brand-700 bg-brand-900 transition-all duration-300 hover:-translate-y-1 hover:border-significance-high/40 hover:shadow-lg hover:shadow-significance-high/10">
                <CardContent className="p-6 text-center">
                  <item.icon className="mx-auto h-8 w-8 text-significance-high transition-transform duration-300 group-hover:scale-110" />
                  <p className="mt-4 text-4xl font-bold">
                    <CountUp
                      value={item.value}
                      prefix={item.prefix}
                      suffix={item.suffix}
                      decimals={item.decimals}
                    />
                  </p>
                  <p className="mt-1 font-medium">{item.label}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description}
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
