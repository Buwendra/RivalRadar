import { Globe, Cpu, Mail } from "lucide-react";

const steps = [
  {
    icon: Globe,
    title: "1. Add Competitor URLs",
    description:
      "Enter your competitor websites and choose which pages to monitor — pricing, features, blog, careers, or homepage.",
  },
  {
    icon: Cpu,
    title: "2. AI Monitors Daily",
    description:
      "Our AI scrapes your competitors every day, detects changes, and analyzes their strategic significance on a 1-10 scale.",
  },
  {
    icon: Mail,
    title: "3. Get Strategic Briefs",
    description:
      "Receive weekly intelligence digests with actionable insights, or instant alerts when high-significance changes are detected.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-muted-foreground">
            From setup to actionable intelligence in under 2 minutes.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="relative text-center">
              {index < steps.length - 1 && (
                <div className="absolute right-0 top-12 hidden h-px w-full translate-x-1/2 bg-gradient-to-r from-brand-700 to-transparent md:block" />
              )}
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-brand-700 bg-brand-900">
                <step.icon className="h-10 w-10 text-primary" />
              </div>
              <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
