import { Globe, Cpu, Mail } from "lucide-react";
import { Reveal } from "./reveal";

const steps = [
  {
    icon: Globe,
    title: "1. Add Your Competitors — and Yourself",
    description:
      "Enter your competitor websites and your own. Your brand runs through the same research engine, so every insight arrives with a benchmark.",
  },
  {
    icon: Cpu,
    title: "2. AI Researches Everyone Weekly",
    description:
      "Claude-powered deep research scans the live web for each competitor — and for your own brand — every week or on demand, scoring each finding 1-10 for strategic significance.",
  },
  {
    icon: Mail,
    title: "3. See What Moved — and the Gap",
    description:
      "A weekly brief of what changed and where you stand, plus same-day email alerts when research surfaces a high-significance move.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-muted-foreground">
              From setup to actionable intelligence in under 2 minutes.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <Reveal
              key={step.title}
              delay={index * 150}
              className="group relative text-center"
            >
              {index < steps.length - 1 && (
                <div className="absolute right-0 top-12 hidden h-px w-full translate-x-1/2 bg-gradient-to-r from-brand-700 to-transparent md:block" />
              )}
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-brand-700 bg-brand-900 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-[0_0_30px_-10px] group-hover:shadow-primary/50">
                <step.icon className="h-10 w-10 text-primary transition-transform duration-300 group-hover:scale-110" />
              </div>
              <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
