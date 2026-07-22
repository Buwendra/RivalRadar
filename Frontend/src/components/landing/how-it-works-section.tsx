const steps = [
  {
    number: "01",
    title: "Add your competitors — and yourself",
    description:
      "Enter your competitor websites and your own. Your brand runs through the same research engine, so every insight arrives with a benchmark.",
  },
  {
    number: "02",
    title: "The research runs every week",
    description:
      "Claude-powered deep research scans the live web for each company — news, product, funding, hiring, social — and scores each finding 1–10 for strategic significance.",
  },
  {
    number: "03",
    title: "You read one brief on Monday",
    description:
      "A weekly brief of what changed and where you stand. When something big surfaces mid-week, an alert lands the same day.",
  },
];

import { SignalField } from "./signal-field";

export function HowItWorksSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-24">
      {/* Fragments fall down the step gutter and tighten into a single lane as
          they pass each step: scattered text, then scored gold, then ordered
          ticks. The gates are measured off the [data-signal-gate] items. */}
      <SignalField mode="conduit" />

      <div className="relative mx-auto grid max-w-5xl gap-10 md:grid-cols-[5fr_7fr] md:gap-16">
        <div>
          <h2 className="font-display text-3xl font-medium leading-[1.15] tracking-[-0.01em] sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-muted-foreground">
            Setup takes about two minutes. After that, the reading is the whole
            job.
          </p>
        </div>

        <ol className="space-y-10">
          {steps.map((step) => (
            <li
              key={step.number}
              data-signal-gate
              className="grid grid-cols-[auto_1fr] gap-5"
            >
              <span
                className="pt-1 font-mono text-sm text-primary/80"
                aria-hidden
              >
                {step.number}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
