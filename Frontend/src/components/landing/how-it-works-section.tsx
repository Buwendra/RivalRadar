import { SignalField } from "./signal-field";
import { Dateline } from "@/components/marketing/editorial";

const steps = [
  {
    number: "01",
    title: "Add your competitors, and yourself",
    description:
      "Enter your competitor sites and your own. Your brand runs through the identical research engine, so every finding arrives with a benchmark instead of a guess.",
  },
  {
    number: "02",
    title: "The research runs every week",
    description:
      "Claude-powered deep research reads the live web for each company (news, product, funding, hiring, social) and scores every finding 1–10 for how much it actually matters.",
  },
  {
    number: "03",
    title: "You read one brief on Monday",
    description:
      "A single brief: what changed, and where you stand against it. When something big breaks mid-week, the alert lands the day we find it.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:px-8 sm:py-28">
      {/* Fragments fall down the step gutter and tighten into a single lane as
          they pass each step: scattered text, then scored gold, then ordered
          ticks. The gates are measured off the [data-signal-gate] items. */}
      <SignalField mode="conduit" />

      <div className="relative mx-auto grid max-w-5xl gap-10 md:grid-cols-[5fr_7fr] md:gap-16">
        <div className="md:sticky md:top-28 md:self-start">
          <Dateline index="02">The workflow</Dateline>
          <h2 className="mt-6 font-display text-display-m font-medium">
            One engine, pointed both ways.
          </h2>
          <p className="mt-4 text-body-lg text-muted-foreground measure-tight">
            Setup takes minutes. After that, the reading is the whole job.
          </p>
        </div>

        <ol className="space-y-10">
          {steps.map((step) => (
            <li
              key={step.number}
              data-signal-gate
              className="grid grid-cols-[auto_1fr] gap-5 border-t border-ink/[0.08] pt-6 first:border-t-0 first:pt-0"
            >
              <span
                className="nums-tabular pt-0.5 font-mono text-sm text-muted-foreground"
                aria-hidden
              >
                {step.number}
              </span>
              <div>
                <h3 className="font-display text-title text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground measure">
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
