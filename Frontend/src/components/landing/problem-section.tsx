import { SignalField } from "./signal-field";
import { Dateline } from "@/components/marketing/editorial";

export function ProblemSection() {
  return (
    <section className="relative overflow-hidden border-t border-ink/[0.08] bg-obsidian-900/40 px-6 py-24 sm:px-8 sm:py-28">
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
        <div className="md:sticky md:top-28 md:self-start">
          <Dateline index="01">The blind spot</Dateline>
          <h2 className="mt-6 font-display text-display-m font-medium">
            Watching your competitors is only{" "}
            <em className="italic">half</em> the picture.
          </h2>
        </div>

        <div className="space-y-5 text-body-lg text-ink/75 measure">
          <p>
            Every week your competitors change pricing, ship features, raise
            money, and hire for roles that telegraph where they&rsquo;re headed.
            Most of it happens quietly. You find out in a lost deal, months
            later, from a prospect who assumed you already knew.
          </p>
          <p>
            So you try to watch them. But watching them tells you what they did,
            not whether it moved you. The market is forming an opinion of{" "}
            <em className="italic text-ink">your</em> brand at the same time
            (your coverage, your sentiment, your share of the conversation), and
            almost nobody is reading that side.
          </p>
          <p>
            Kironyx runs one engine across both. It researches your competitors
            and your own brand the same way, every week, and files the gap
            between them, so what you read is your position, not just their
            headlines.
          </p>
        </div>
      </div>
    </section>
  );
}
