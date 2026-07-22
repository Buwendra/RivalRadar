import { CountUp } from "./count-up";
import { LiveFeed } from "./live-feed";

/**
 * Stylized product preview for the hero: a floating dashboard window with
 * the live feed, a Brand Health ring, and Share of Voice bars. All data is
 * fictional; the surfaces mirror real product features.
 */
const SHARE_OF_VOICE = [
  { name: "You", pct: 34, barClass: "bg-primary", self: true },
  { name: "Acme Analytics", pct: 28, barClass: "bg-blue-500", self: false },
  { name: "Northwind", pct: 22, barClass: "bg-blue-500/70", self: false },
  { name: "BoldMetrics", pct: 16, barClass: "bg-blue-500/40", self: false },
];

export function HeroMockup() {
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
                    background:
                      "conic-gradient(#F59E0B 0% 74%, #201E1B 74% 100%)",
                  }}
                >
                  <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-obsidian-950 text-2xl font-bold">
                    <CountUp value={74} />
                  </div>
                </div>
                <div className="text-sm">
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
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {row.pct}%
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
