"use client";

import { useEffect, useState } from "react";
import { LiveFeed } from "./live-feed";

/**
 * Stylized product preview for the hero: a floating dashboard window with
 * the live feed, a Brand Health ring, and Share of Voice bars. All data is
 * fictional; the surfaces mirror real product features.
 *
 * The Brand Health number, its ring, and the Share-of-Voice bars start empty
 * and fill in one motion, cued by "kx-signal-resolved" — the moment the hero's
 * signal collapse lands in this window. So the data visibly *arrives* as
 * everything converges, instead of being pre-filled on load.
 */
const BRAND_HEALTH = 74;

const SHARE_OF_VOICE = [
  { name: "You", pct: 34, barClass: "bg-primary", self: true },
  { name: "Acme Analytics", pct: 28, barClass: "bg-blue-500", self: false },
  { name: "Northwind", pct: 22, barClass: "bg-blue-500/70", self: false },
  { name: "BoldMetrics", pct: 16, barClass: "bg-blue-500/40", self: false },
];

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function HeroMockup() {
  // 0 → 1 fill progress. SSR + no-JS render 0 (an empty dashboard waiting for
  // the signal); reduced motion snaps to filled; otherwise it animates on the
  // resolve cue, re-syncing if the collapse replays.
  const [p, setP] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setP(1);
      return;
    }
    let raf = 0;
    let eventSeen = false;
    const animate = () => {
      cancelAnimationFrame(raf);
      const start = performance.now();
      const duration = 1100;
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        setP(easeOut(t));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const onResolved = () => {
      eventSeen = true;
      animate();
    };
    window.addEventListener("kx-signal-resolved", onResolved);
    // Safety net: fill anyway if the collapse never cues us (target off-screen).
    const fallback = window.setTimeout(() => {
      if (!eventSeen) animate();
    }, 5200);
    return () => {
      window.removeEventListener("kx-signal-resolved", onResolved);
      window.clearTimeout(fallback);
      cancelAnimationFrame(raf);
    };
  }, []);

  const healthPct = BRAND_HEALTH * p;
  const health = Math.round(healthPct);

  return (
    <div className="relative mx-auto mt-16 max-w-5xl animate-fade-up [animation-delay:300ms]">
      {/* Ambient glow behind the window */}
      <div
        className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-primary/[0.08] blur-3xl"
        aria-hidden
      />
      {/* data-signal-target: the hero's SignalCollapse field collapses into
          this window and pulses its rim gold on impact. */}
      <div
        data-signal-target
        className="relative overflow-hidden rounded-xl border border-ink/10 bg-obsidian-900/90 shadow-[inset_0_1px_0_rgba(225,217,193,0.08)] backdrop-blur transition-transform duration-700 [transform:perspective(1600px)_rotateX(5deg)] hover:[transform:perspective(1600px)_rotateX(0deg)]"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-ink/[0.06] bg-obsidian-950/60 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-significance-high/60" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-significance-medium/60" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-significance-low/60" aria-hidden />
          <div className="mx-auto rounded-md bg-obsidian-800/80 px-3 py-1 font-mono text-xs text-muted-foreground">
            app.kironyx.com/dashboard
          </div>
        </div>

        {/* Dashboard body */}
        <div className="grid gap-4 p-4 text-left sm:p-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <LiveFeed />
          </div>

          <div className="space-y-4 lg:col-span-2">
            {/* Brand Health */}
            <div className="rounded-lg border border-ink/[0.06] bg-obsidian-950/50 p-4">
              <p className="text-sm font-medium">Brand Health</p>
              <div className="mt-3 flex items-center gap-4">
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(#F59E0B 0% ${healthPct.toFixed(
                      1,
                    )}%, #201E1B ${healthPct.toFixed(1)}% 100%)`,
                  }}
                >
                  <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-obsidian-950 text-2xl font-bold tabular-nums">
                    {health}
                  </div>
                </div>
                <div className="text-sm" style={{ opacity: p }}>
                  <p className="font-medium text-significance-low">
                    ▲ 6 pts this week
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sentiment, voice &amp; momentum, side by side with your set
                  </p>
                </div>
              </div>
            </div>

            {/* Share of Voice */}
            <div className="rounded-lg border border-ink/[0.06] bg-obsidian-950/50 p-4">
              <p className="text-sm font-medium">
                Share of Voice{" "}
                <span className="font-normal text-muted-foreground">· 30d</span>
              </p>
              <div className="mt-3 space-y-2.5">
                {SHARE_OF_VOICE.map((row) => (
                  <div key={row.name} className="flex items-center gap-3">
                    <span
                      className={
                        row.self
                          ? "w-28 shrink-0 truncate text-xs font-semibold text-primary"
                          : "w-28 shrink-0 truncate text-xs text-muted-foreground"
                      }
                    >
                      {row.name}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-obsidian-800">
                      <div
                        className={`h-full rounded-full ${row.barClass}`}
                        style={{ width: `${(row.pct * p).toFixed(1)}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {Math.round(row.pct * p)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
