import { ReactNode } from "react";
import { SignalField } from "@/components/landing/signal-field";

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}

/** Standard hero band for marketing subpages: mono eyebrow, weight-capped
 *  display heading, one anchored radial glow, and the house signal field at
 *  low intensity so every page opens in the same world as the landing page. */
export function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24">
      <SignalField mode="drift" />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/[0.08] blur-[100px]"
        aria-hidden
      />
      {/* Reading scrim for the heading block. obsidian-950 (#0E0D0C) inlined —
          gradient stops can't reference the Tailwind token. */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(14,13,12,0.92)_0%,rgba(14,13,12,0.55)_55%,rgba(14,13,12,0)_100%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="animate-fade-up font-mono text-xs uppercase tracking-[0.08em] text-primary/80">
          {eyebrow}
        </p>
        <h1 className="mt-4 animate-fade-up font-display text-4xl font-medium leading-[1.1] tracking-[-0.01em] [animation-delay:60ms] sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg text-ink/70 [animation-delay:120ms]">
            {description}
          </p>
        )}
        {children && (
          <div className="mt-8 animate-fade-up [animation-delay:180ms]">{children}</div>
        )}
      </div>
    </section>
  );
}
