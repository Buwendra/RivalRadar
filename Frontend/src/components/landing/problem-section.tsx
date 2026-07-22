import { SignalField } from "./signal-field";

export function ProblemSection() {
  return (
    <section className="relative overflow-hidden border-t border-ink/[0.06] bg-obsidian-900/40 px-4 py-20 sm:px-6 sm:py-24">
      {/* Noise that piles up and never resolves — the state this section
          describes. Fragments flare gold now and then and sink back unread. */}
      <SignalField mode="unresolved" />
      {/* Reading scrim: these are long paragraphs, so contrast wins over
          texture. obsidian-900 (#161513) inlined — gradient stops can't
          reference the Tailwind token. */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_50%,rgba(22,21,19,0.93)_0%,rgba(22,21,19,0.6)_55%,rgba(22,21,19,0)_100%)]"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-5xl gap-10 md:grid-cols-[5fr_7fr] md:gap-16">
        <h2 className="font-display text-3xl font-medium leading-[1.15] tracking-[-0.01em] sm:text-4xl">
          You already know your competitors matter. You just don&rsquo;t have
          time to <em className="italic text-primary">watch</em> them.
        </h2>

        <div className="space-y-5 text-[17px] leading-relaxed text-ink/75">
          <p>
            Every week the companies you compete with change their pricing,
            ship features, raise money, and hire for roles that tell you
            exactly where they&rsquo;re headed. Most of it happens quietly. You
            find out in a lost deal, months later, from a prospect who assumed
            you already knew.
          </p>
          <p>
            The tools built for this problem — Crayon, Klue — are genuinely
            good, and their pricing starts around $20,000 a year behind a
            sales call. Google Alerts is free and forwards you keyword matches
            with no sense of what matters. In between sits &ldquo;I&rsquo;ll
            check their websites when things calm down,&rdquo; which is to say:
            never.
          </p>
          <p>
            Kironyx sits in that gap on purpose. And it watches your own brand
            with the same engine it points at them — because half of
            competitive intelligence is knowing where{" "}
            <em className="italic text-ink">you</em> actually stand.
          </p>
        </div>
      </div>
    </section>
  );
}
