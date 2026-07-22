"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  blit,
  clamp01,
  easeOut,
  FRAGMENTS,
  type FieldContext,
  type FieldHooks,
  type MountOptions,
  mountField,
} from "./signal-runtime";

/**
 * Ambient signal fields for the marketing surface. Each mode is one beat of the
 * same story the hero tells — raw web noise being compressed into signal:
 *
 *   unresolved — noise that never resolves. The problem, before Kironyx.
 *   conduit    — noise falling through the pipeline, ordering as it descends.
 *   lattice    — the settled, ordered end state. Quiet.
 *   converge   — everything funnelling inward. Used to close the page.
 *   drift      — the low-intensity house signature for subpage heroes.
 *
 * The hero's own set-piece is separate (`signal-collapse.tsx`); it shares this
 * file's runtime but owns a bespoke timeline.
 */
export type SignalMode =
  | "unresolved"
  | "conduit"
  | "lattice"
  | "converge"
  | "drift";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sprite: number;
  rot: number;
  alpha: number;
  /** Wobble phase, also reused as a generic per-particle random offset. */
  phase: number;
  /** Lateral offset in [-1, 1], used by lane-based modes. */
  off: number;
  flareAt: number;
  /** Renders as a readable word; otherwise a featureless tick. */
  glyph: boolean;
}

/**
 * `glyphRatio` is the fraction that render as actual words. The section fields
 * keep it low — a page-length wall of text competes with the copy — while the
 * ticks preserve density and movement. Words are reserved for the moments that
 * are supposed to mean something (a flare, an ignition).
 */
function seed(count: number, glyphRatio = 1): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: 0,
    y: 0,
    vx: (Math.random() - 0.5) * 0.16,
    vy: 0.04 + Math.random() * 0.14,
    sprite: i % FRAGMENTS.length,
    rot: (Math.random() - 0.5) * 0.5,
    alpha: 0.3 + Math.random() * 0.55,
    phase: Math.random() * Math.PI * 2,
    off: Math.random() * 2 - 1,
    flareAt: 0,
    glyph: Math.random() < glyphRatio,
  }));
}

/** A wordless particle: a faint tick carrying texture but no reading load. */
function mote(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alpha: number,
  color: string
) {
  if (alpha <= 0.004) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x - 1.5, y - 0.5, 3, 1);
}

function scatter(ps: Particle[], w: number, h: number) {
  for (const p of ps) {
    p.x = Math.random() * w;
    p.y = Math.random() * h;
  }
}

/** Density tuned per mode; every mode caps so a 4K viewport can't run away. */
function countFor(fc: FieldContext, divisor: number, cap: number) {
  return Math.min(cap, Math.max(60, Math.round((fc.width * fc.height) / divisor)));
}

/** Rescale in place on resize — rebuilding would visibly restart the effect. */
function rescale(ps: Particle[], fc: FieldContext, prev: { width: number; height: number }) {
  if (prev.width <= 0 || prev.height <= 0) return;
  const sx = fc.width / prev.width;
  const sy = fc.height / prev.height;
  for (const p of ps) {
    p.x *= sx;
    p.y *= sy;
  }
}

// --- unresolved -------------------------------------------------------------
// Noise that accumulates and never resolves. Every so often one fragment
// flares — something that mattered — and sinks back into the pile unread.
function unresolvedMode(): { hooks: FieldHooks; options: MountOptions } {
  let ps: Particle[] = [];
  let nextFlare = 0;

  const build = (fc: FieldContext) => {
    ps = seed(countFor(fc, 3000, 340), 0.22);
    scatter(ps, fc.width, fc.height);
  };

  return {
    options: { startInView: true },
    hooks: {
      layout(fc, prev) {
        if (!ps.length) build(fc);
        else rescale(ps, fc, prev);
      },
      reset(fc) {
        build(fc);
        nextFlare = 0;
      },
      draw(fc, t, dt, now) {
        const ramp = clamp01(t / 2600);
        if (nextFlare === 0) nextFlare = now + 1200;
        if (now > nextFlare) {
          nextFlare = now + 1500 + Math.random() * 2000;
          const pick = ps[Math.floor(Math.random() * ps.length)];
          if (pick && pick.flareAt === 0) pick.flareAt = now;
        }

        for (const p of ps) {
          p.phase += 0.006 * dt;
          p.x += (p.vx + Math.sin(p.phase) * 0.1) * dt;
          p.y += p.vy * 0.5 * dt;
          if (p.y > fc.height + 30) {
            p.y = -30;
            p.x = Math.random() * fc.width;
          }
          if (p.x < -90) p.x = fc.width + 90;
          else if (p.x > fc.width + 90) p.x = -90;

          if (p.flareAt > 0) {
            const age = now - p.flareAt;
            if (age < 1600) {
              // A flare always shows its word, even for a tick particle —
              // this is the "something that mattered" beat, so it has to be
              // legible for the moment it exists.
              const lift = Math.sin((age / 1600) * Math.PI);
              blit(
                fc.ctx,
                fc.gold[p.sprite],
                p.x,
                p.y,
                p.alpha * ramp * (0.16 + lift * 0.7),
                p.rot
              );
              continue;
            }
            p.flareAt = 0;
          }
          if (p.glyph) {
            blit(fc.ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * 0.19 * ramp, p.rot);
          } else {
            mote(fc.ctx, p.x, p.y, p.alpha * 0.3 * ramp, fc.palette.ink);
          }
        }
      },
      still(fc) {
        for (const p of ps) {
          if (p.glyph) blit(fc.ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * 0.19, p.rot);
          else mote(fc.ctx, p.x, p.y, p.alpha * 0.3, fc.palette.ink);
        }
      },
    },
  };
}

// --- conduit ----------------------------------------------------------------
// Fragments fall down the step gutter, tightening into a single lane as they
// pass each numbered step: scattered text at the top, scored gold in the
// middle, ordered ticks by the bottom. Gate positions are measured from the
// real `[data-signal-gate]` elements so the transitions land on the steps.
function conduitMode(): { hooks: FieldHooks; options: MountOptions } {
  let ps: Particle[] = [];
  let gates: number[] = [];
  let laneX = 0;

  const measure = (fc: FieldContext) => {
    const els = Array.from(
      fc.host.querySelectorAll<HTMLElement>("[data-signal-gate]")
    );
    const hostRect = fc.host.getBoundingClientRect();
    if (els.length >= 2) {
      gates = els.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top - hostRect.top + r.height / 2;
      });
      const first = els[0].getBoundingClientRect();
      laneX = first.left - hostRect.left + 9;
    } else {
      gates = [fc.height * 0.3, fc.height * 0.55, fc.height * 0.82];
      laneX = fc.width * 0.5;
    }
  };

  const build = (fc: FieldContext) => {
    ps = seed(countFor(fc, 4800, 200), 0.2);
    for (const p of ps) {
      p.x = laneX + p.off * 200;
      p.y = Math.random() * fc.height;
    }
  };

  return {
    options: { startInView: true },
    hooks: {
      layout(fc, prev) {
        measure(fc);
        if (!ps.length) build(fc);
        else rescale(ps, fc, prev);
      },
      reset(fc) {
        measure(fc);
        build(fc);
      },
      draw(fc, t, dt) {
        const { ctx } = fc;
        const ramp = clamp01(t / 1800);
        const scored = gates[1] ?? fc.height * 0.55;
        const briefed = gates[gates.length - 1] ?? fc.height * 0.82;

        // The lane itself: a hairline linking the steps.
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.1 * ramp;
        ctx.fillStyle = fc.palette.gold;
        ctx.fillRect(laneX - 0.5, gates[0] ?? 0, 1, briefed - (gates[0] ?? 0));
        ctx.globalCompositeOperation = "source-over";

        for (const p of ps) {
          p.y += (0.55 + p.vy * 2) * dt;
          if (p.y > fc.height + 24) {
            p.y = -24;
            p.x = laneX + p.off * 220;
          }

          // Lateral spread collapses to nothing by the final gate.
          const u = clamp01(p.y / Math.max(1, briefed));
          const spread = 210 * (1 - easeOut(u)) + 4;
          const targetX = laneX + p.off * spread;
          p.x += (targetX - p.x) * Math.min(1, 0.07 * dt);

          if (p.y < scored) {
            if (p.glyph) {
              blit(ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * 0.2 * ramp, p.rot);
            } else {
              mote(ctx, p.x, p.y, p.alpha * 0.32 * ramp, fc.palette.ink);
            }
          } else if (p.y < briefed) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.55 * ramp;
            ctx.fillStyle = fc.palette.gold;
            ctx.fillRect(p.x - 1.25, p.y - 1.25, 2.5, 2.5);
            ctx.globalCompositeOperation = "source-over";
          } else {
            const fade = 1 - clamp01((p.y - briefed) / Math.max(1, fc.height - briefed));
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.75 * fade * ramp;
            ctx.fillStyle = fc.palette.gold;
            ctx.fillRect(laneX - 4, p.y - 0.75, 8, 1.5);
            ctx.globalCompositeOperation = "source-over";
          }
        }
      },
      still(fc) {
        const { ctx } = fc;
        const briefed = gates[gates.length - 1] ?? fc.height * 0.82;
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = fc.palette.gold;
        ctx.fillRect(laneX - 0.5, gates[0] ?? 0, 1, briefed - (gates[0] ?? 0));
        for (const p of ps) {
          if (p.y >= (gates[1] ?? 0)) continue;
          if (p.glyph) blit(ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * 0.18, p.rot);
          else mote(ctx, p.x, p.y, p.alpha * 0.3, fc.palette.ink);
        }
      },
    },
  };
}

// --- lattice ----------------------------------------------------------------
// The settled end state: an ordered grid of ticks, a handful glowing at any
// moment. Deliberately the calmest mode — it sits behind feature copy.
function latticeMode(): { hooks: FieldHooks; options: MountOptions } {
  let cells: { x: number; y: number; offset: number }[] = [];
  const STEP = 46;

  const build = (fc: FieldContext) => {
    cells = [];
    for (let y = STEP / 2; y < fc.height; y += STEP) {
      for (let x = STEP / 2; x < fc.width; x += STEP) {
        cells.push({ x, y, offset: Math.random() * Math.PI * 2 });
      }
    }
  };

  const paint = (fc: FieldContext, now: number, ramp: number) => {
    const { ctx } = fc;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = fc.palette.gold;
    for (const c of cells) {
      const pulse = Math.sin(now / 1500 + c.offset);
      // Only the top of each cell's cycle lights up, so most stay dim.
      const a = pulse > 0.86 ? (pulse - 0.86) / 0.14 : 0;
      ctx.globalAlpha = (0.035 + a * 0.5) * ramp;
      ctx.fillRect(c.x - 2.5, c.y - 0.5, 5, 1);
    }
    ctx.globalCompositeOperation = "source-over";
  };

  return {
    options: { startInView: true },
    hooks: {
      layout(fc) {
        build(fc);
      },
      reset(fc) {
        build(fc);
      },
      draw(fc, t, dt, now) {
        paint(fc, now, clamp01(t / 2200));
      },
      still(fc) {
        paint(fc, 0, 1);
      },
    },
  };
}

// --- converge ---------------------------------------------------------------
// Everything funnels inward and winks out at the centre. Closes the page by
// echoing the hero's collapse at a fraction of the scale.
function convergeMode(): { hooks: FieldHooks; options: MountOptions } {
  let ps: Particle[] = [];
  let cx = 0;
  let cy = 0;

  const place = (p: Particle, fc: FieldContext) => {
    // Born on the perimeter, so the inward flow reads from every edge.
    const edge = Math.floor(Math.random() * 4);
    const along = Math.random();
    if (edge === 0) {
      p.x = along * fc.width;
      p.y = -20;
    } else if (edge === 1) {
      p.x = fc.width + 20;
      p.y = along * fc.height;
    } else if (edge === 2) {
      p.x = along * fc.width;
      p.y = fc.height + 20;
    } else {
      p.x = -20;
      p.y = along * fc.height;
    }
    p.vx = 0;
    p.vy = 0;
  };

  const build = (fc: FieldContext) => {
    // Denser than the other modes: this card is small, so a sparse field reads
    // as nothing at all rather than as restraint. Mostly ticks, though — the
    // funnel is about motion, not reading.
    ps = seed(countFor(fc, 1700, 230), 0.18);
    for (const p of ps) place(p, fc);
  };

  return {
    options: { startInView: true },
    hooks: {
      layout(fc, prev) {
        cx = fc.width / 2;
        // Low in the card, so the funnel lands behind the CTA button rather
        // than over the body copy.
        cy = fc.height * 0.66;
        if (!ps.length) build(fc);
        else rescale(ps, fc, prev);
      },
      reset(fc) {
        build(fc);
      },
      draw(fc, t, dt, now) {
        const { ctx } = fc;
        const ramp = clamp01(t / 2000);

        for (const p of ps) {
          const dx = cx - p.x;
          const dy = cy - p.y;
          const d = Math.hypot(dx, dy) || 1;
          // Radial pull dominates, and the tangential swirl decays as the
          // particle closes in. Equal-weighted swirl produced stable orbits —
          // a visible ring of debris parked over the copy instead of a funnel.
          const swirl = 0.05 * clamp01(d / 260);
          p.vx += ((dx / d) * 0.3 + (-dy / d) * swirl) * dt;
          p.vy += ((dy / d) * 0.3 + (dx / d) * swirl) * dt;
          p.vx *= 0.972;
          p.vy *= 0.972;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          if (d < 70) {
            place(p, fc);
            continue;
          }
          // Fades as it nears the centre — consumed, not piled up.
          const near = clamp01((d - 70) / 170);
          if (p.glyph) {
            blit(ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * 0.26 * near * ramp, p.rot);
          } else {
            mote(ctx, p.x, p.y, p.alpha * 0.42 * near * ramp, fc.palette.ink);
          }
        }

        // Core glow, breathing slowly.
        const breathe = 0.5 + 0.5 * Math.sin(now / 1800);
        const r = 70 + breathe * 30;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        glow.addColorStop(0, fc.palette.gold);
        glow.addColorStop(1, "transparent");
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.17 * ramp;
        ctx.fillStyle = glow;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.globalCompositeOperation = "source-over";
      },
      still(fc) {
        for (const p of ps) {
          if (p.glyph) blit(fc.ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * 0.16, p.rot);
          else mote(fc.ctx, p.x, p.y, p.alpha * 0.3, fc.palette.ink);
        }
      },
    },
  };
}

// --- drift ------------------------------------------------------------------
// The house signature at low intensity, for subpage heroes: a slow field with
// the occasional fragment igniting gold.
function driftMode(): { hooks: FieldHooks; options: MountOptions } {
  let ps: Particle[] = [];
  let nextIgnite = 0;

  const build = (fc: FieldContext) => {
    ps = seed(countFor(fc, 3400, 250), 0.2);
    scatter(ps, fc.width, fc.height);
  };

  return {
    options: { startInView: true },
    hooks: {
      layout(fc, prev) {
        if (!ps.length) build(fc);
        else rescale(ps, fc, prev);
      },
      reset(fc) {
        build(fc);
        nextIgnite = 0;
      },
      draw(fc, t, dt, now) {
        const ramp = clamp01(t / 2400);
        if (nextIgnite === 0) nextIgnite = now + 1400;
        if (now > nextIgnite) {
          nextIgnite = now + 2400 + Math.random() * 2600;
          const pick = ps[Math.floor(Math.random() * ps.length)];
          if (pick && pick.flareAt === 0) pick.flareAt = now;
        }

        for (const p of ps) {
          p.phase += 0.005 * dt;
          p.x += (p.vx * 0.5 + Math.sin(p.phase) * 0.06) * dt;
          p.y -= p.vy * 0.28 * dt;
          if (p.y < -30) {
            p.y = fc.height + 30;
            p.x = Math.random() * fc.width;
          }
          if (p.x < -90) p.x = fc.width + 90;
          else if (p.x > fc.width + 90) p.x = -90;

          if (p.flareAt > 0) {
            const age = now - p.flareAt;
            if (age < 1700) {
              // As with `unresolved`: an ignition always shows its word.
              const lift = Math.sin((age / 1700) * Math.PI);
              blit(
                fc.ctx,
                fc.gold[p.sprite],
                p.x,
                p.y,
                p.alpha * ramp * (0.14 + lift * 0.6),
                p.rot
              );
              continue;
            }
            p.flareAt = 0;
          }
          if (p.glyph) {
            blit(fc.ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * 0.16 * ramp, p.rot);
          } else {
            mote(fc.ctx, p.x, p.y, p.alpha * 0.26 * ramp, fc.palette.ink);
          }
        }
      },
      still(fc) {
        for (const p of ps) {
          if (p.glyph) blit(fc.ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * 0.16, p.rot);
          else mote(fc.ctx, p.x, p.y, p.alpha * 0.26, fc.palette.ink);
        }
      },
    },
  };
}

const MODES: Record<SignalMode, () => { hooks: FieldHooks; options: MountOptions }> = {
  unresolved: unresolvedMode,
  conduit: conduitMode,
  lattice: latticeMode,
  converge: convergeMode,
  drift: driftMode,
};

/**
 * Soft top/bottom falloff so a field dissolves at the section seam instead of
 * cutting off at a hard horizontal edge. `converge` opts out — it lives inside
 * a rounded card that already clips it, and fading would erase it.
 */
const EDGE_FADE =
  "[-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_14%,black_88%,transparent_100%)] [mask-image:linear-gradient(to_bottom,transparent_0%,black_14%,black_88%,transparent_100%)]";

const MODE_MASK: Record<SignalMode, string> = {
  unresolved: EDGE_FADE,
  conduit: EDGE_FADE,
  lattice: EDGE_FADE,
  converge: "",
  drift: EDGE_FADE,
};

export function SignalField({
  mode,
  className,
}: {
  mode: SignalMode;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { hooks, options } = MODES[mode]();
    return mountField(canvas, hooks, options);
  }, [mode]);

  return (
    <canvas
      ref={ref}
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        MODE_MASK[mode],
        className
      )}
      aria-hidden
    />
  );
}
