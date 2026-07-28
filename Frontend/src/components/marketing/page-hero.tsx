import { ReactNode } from "react";
import { SignalField } from "@/components/landing/signal-field";

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}

/**
 * Shared subpage hero — the masthead every marketing subpage opens on. A
 * hairline-flanked mono kicker, a display-weight Fraunces title, a measured
 * standfirst, and the house signal field at low intensity so every page reads
 * as part of the same publication as the landing hero.
 */
export function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden px-6 py-20 sm:px-8 sm:py-28">
      <SignalField mode="drift" />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-[100px]"
        aria-hidden
      />
      {/* Reading scrim for the heading block. obsidian-950 (#0E0D0C) inlined —
          gradient stops can't reference the Tailwind token. */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(14,13,12,0.92)_0%,rgba(14,13,12,0.55)_55%,rgba(14,13,12,0)_100%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <div className="flex animate-fade-up items-center justify-center gap-3 font-mono text-label uppercase text-muted-foreground">
          <span aria-hidden className="h-px w-6 bg-foreground/30" />
          <span>{eyebrow}</span>
          <span aria-hidden className="h-px w-6 bg-foreground/30" />
        </div>
        <h1 className="mt-6 animate-fade-up font-display text-display-l font-medium [animation-delay:60ms]">
          {title}
        </h1>
        {description && (
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-standfirst text-ink/70 [animation-delay:120ms]">
            {description}
          </p>
        )}
        {children && (
          <div className="mt-9 animate-fade-up [animation-delay:180ms]">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
