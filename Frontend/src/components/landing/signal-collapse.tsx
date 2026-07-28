"use client";

import { useEffect, useRef } from "react";
import {
  blit,
  clamp01,
  easeIn,
  easeOut,
  FRAGMENTS,
  type FieldContext,
  mountField,
} from "./signal-runtime";
import {
  emitSignalDelivery,
  FINDING_FRAGMENT_INDEX,
  FINDINGS,
  type SignalDeliveryDetail,
} from "./feed-data";

/**
 * The hero set-piece: the product's job, told as motion.
 *
 * A field of raw web-noise fragments drifts chaotically, then implodes into a
 * single point above the dashboard mockup, flashes, and re-forms as ONE bright
 * line of signal that sinks into the product — and the moment it does, a
 * delivery event tells the LiveFeed mockup to materialize a new entry: the
 * gathered noise visibly becoming a row in the dashboard. Six hundred
 * fragments in, one brief out.
 *
 * After the opening sequence it settles into a full-height ambient drift.
 * Every few seconds one fragment ignites gold — always the word paired to the
 * NEXT feed finding (see `feed-data.ts`) — and arcs into the feed panel; when
 * it crosses into the window (the DOM occludes the final approach), another
 * delivery event births the matching entry. The story loops forever.
 *
 * Shares `signal-runtime` (atlas, palette, loop, reduced-motion handling) with
 * the ambient section fields, but owns its own timeline — this is the only
 * field on the site that tells a beginning-to-end story.
 *
 * The convergence target is whichever element carries `data-signal-target`
 * (the hero mockup); streaks aim at `[data-signal-feed]` (the feed panel).
 * If either is missing the sequence falls back to fixed points and still
 * works — deliveries then fire at flight end instead of on window crossing.
 */

// Sequence timeline, ms from start.
const T_NOISE = 1250; // chaotic drift, fading in
const T_PULL = 2300; // everything accelerates inward, text becomes streaks
const T_RESOLVE = 3300; // survivors form one line of signal
const T_SETTLE = 4500; // the line sinks into the dashboard; ambient takes over

const FLASH_MS = 420;
const SIGNAL_COUNT = 44; // fragments that survive the collapse as signal
const CORE_RADIUS = 26;
const FLIGHT_MS = 1000; // ambient ignition: fixed flight time into the feed

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sprite: number;
  rot: number;
  vrot: number;
  alpha: number;
  consumed: boolean;
  /** Index into the resolved signal line, or -1 if this one didn't survive. */
  slot: number;
  /** Ambient ignition flight start timestamp, 0 when idle. */
  ignitedAt: number;
  /** Flight origin, recorded at ignition (the bezier's first control point). */
  ix: number;
  iy: number;
  /** Signed perpendicular bend of the flight arc, set at ignition. */
  bend: number;
  /** Latched once the flight enters the window rect (delivery fired). */
  crossed: boolean;
}

export function SignalCollapse() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ps: Particle[] = [];
    /** Collapse point + the line the signal resolves onto, in canvas space. */
    let coreX = 0;
    let coreY = 0;
    let lineX = 0;
    let lineW = 0;
    let flashFired = false;
    let nextIgnite = 0;
    /** Feed panel center — where ambient ignitions deliver to. */
    let feedX = 0;
    let feedY = 0;
    /** Mockup window rect: occlusion boundary for crossing detection. */
    let winTop = 0;
    let winLeft = 0;
    let winRight = 0;
    let winBottom = 0;
    let ambientStart = 0;
    let introDelivered = false;
    /**
     * The finding the NEXT delivery will surface. Starts one step "back" so
     * the first delivered row matches what LiveFeed's own backward rotation
     * would have shown; deliberately NOT reset on replay, so each replay of
     * the intro delivers a fresh finding instead of the same one.
     */
    let nextFindingIndex = FINDINGS.length - 1;
    /**
     * Deliveries queued with a timestamp and pumped from draw(). Living
     * inside the rAF loop means they die with it — no dispatch after
     * unmount, hidden tabs, or Strict-Mode remounts, with zero cleanup code.
     */
    let pendingDeliveries: Array<{ at: number } & SignalDeliveryDetail> = [];

    const queueDelivery = (at: number, kind: SignalDeliveryDetail["kind"]) => {
      pendingDeliveries.push({ at, findingIndex: nextFindingIndex, kind });
      nextFindingIndex =
        (nextFindingIndex - 1 + FINDINGS.length) % FINDINGS.length;
    };

    const measureTarget = (fc: FieldContext) => {
      const el = document.querySelector<HTMLElement>("[data-signal-target]");
      const hostRect = fc.host.getBoundingClientRect();
      if (el) {
        const r = el.getBoundingClientRect();
        coreX = r.left - hostRect.left + r.width / 2;
        coreY = r.top - hostRect.top - 10;
        lineW = r.width * 0.92;
        lineX = r.left - hostRect.left + (r.width - lineW) / 2;
        winLeft = r.left - hostRect.left;
        winTop = r.top - hostRect.top;
        winRight = winLeft + r.width;
        winBottom = winTop + r.height;
      } else {
        coreX = fc.width / 2;
        coreY = fc.height * 0.62;
        lineW = Math.min(fc.width * 0.8, 900);
        lineX = (fc.width - lineW) / 2;
        // Empty rect: crossing never triggers; flights deliver at k=1 instead.
        winLeft = winRight = winTop = winBottom = 0;
      }
      const feedEl = document.querySelector<HTMLElement>("[data-signal-feed]");
      if (feedEl) {
        const fr = feedEl.getBoundingClientRect();
        feedX = fr.left - hostRect.left + fr.width / 2;
        feedY = fr.top - hostRect.top + fr.height / 2;
      } else {
        feedX = coreX;
        feedY = coreY + 120;
      }
    };

    const spawn = (p: Particle, index: number, fc: FieldContext) => {
      p.x = Math.random() * fc.width;
      p.y = Math.random() * fc.height;
      const a = Math.random() * Math.PI * 2;
      const s = 0.06 + Math.random() * 0.16;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.sprite = index % FRAGMENTS.length;
      p.rot = (Math.random() - 0.5) * 0.42;
      p.vrot = (Math.random() - 0.5) * 0.0008;
      p.alpha = 0.28 + Math.random() * 0.5;
      p.consumed = false;
      p.slot = -1;
      p.ignitedAt = 0;
      p.ix = 0;
      p.iy = 0;
      p.bend = 0;
      p.crossed = false;
    };

    const build = (fc: FieldContext) => {
      const target = Math.min(
        320,
        Math.max(64, Math.round((fc.width * fc.height) / 3000))
      );
      ps = new Array(target);
      for (let i = 0; i < target; i += 1) {
        const p = {} as Particle;
        spawn(p, i, fc);
        ps[i] = p;
      }
      // Deal out the signal slots up front so the resolved line is stable.
      const slots = Math.min(SIGNAL_COUNT, target);
      for (let i = 0; i < slots; i += 1) {
        ps[Math.floor((i / slots) * target)].slot = i;
      }
    };

    // The "lens": the market is noise everywhere, and it only resolves into
    // clarity where you look through Kironyx's lens. Fragments inside the
    // central reading column (behind the headline + subhead) fade toward
    // transparent so the copy sits in focus; the chatter stays legible only at
    // the edges. Ties the effect to the "seen through one lens" line instead of
    // filling the hero with competing words. Falls back to a height ratio until
    // the mockup rect is measured (winTop === 0).
    const readingClarity = (x: number, y: number, fc: FieldContext) => {
      const halfW = Math.min(fc.width * 0.44, 560);
      const readBottom = winTop > 8 ? winTop - 8 : fc.height * 0.6;
      const nx = Math.abs(x - fc.width / 2) / halfW;
      const ny = y / readBottom;
      const inside = clamp01(1 - Math.max(nx, ny)); // 1 deep-center → 0 at edge
      const soft = inside * inside * (3 - 2 * inside); // smoothstep
      return 1 - soft * 0.92; // reading column ≈0.08, edges = 1
    };

    const drawStreak = (
      ctx: CanvasRenderingContext2D,
      p: Particle,
      alpha: number,
      len: number
    ) => {
      if (alpha <= 0.004) return;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * len, p.y - p.vy * len);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };

    /** Collapse bloom + expanding shockwave ring. */
    const drawFlash = (fc: FieldContext, f: number) => {
      const { ctx, width, height, palette } = fc;
      const fade = 1 - f;
      ctx.globalCompositeOperation = "lighter";

      const bloomR = 30 + easeOut(f) * Math.max(width, height) * 0.55;
      const bloom = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, bloomR);
      bloom.addColorStop(0, palette.gold);
      bloom.addColorStop(0.18, palette.gold);
      bloom.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.42 * fade * fade;
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);

      const ringR = easeOut(f) * Math.hypot(width, height) * 0.62;
      ctx.globalAlpha = 0.5 * fade;
      ctx.strokeStyle = palette.gold;
      ctx.lineWidth = Math.max(0.6, 5 * fade);
      ctx.beginPath();
      ctx.arc(coreX, coreY, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalCompositeOperation = "source-over";
    };

    /** The resolved hairline of signal above the dashboard. */
    const drawSignalLine = (
      fc: FieldContext,
      reveal: number,
      alpha: number,
      drop: number
    ) => {
      if (alpha <= 0.004) return;
      const { ctx, palette } = fc;
      // Sits just clear of the dashboard's top border, then `drop` sinks it
      // behind the window — the signal being absorbed by the product.
      const y = coreY + 4 + drop;
      const w = lineW * reveal;
      const x = lineX + (lineW - w) / 2;

      ctx.globalCompositeOperation = "lighter";
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, "transparent");
      grad.addColorStop(0.5, palette.gold);
      grad.addColorStop(1, "transparent");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = grad;
      ctx.fillRect(x, y - 0.75, w, 1.5);

      ctx.globalAlpha = alpha * 0.35;
      ctx.fillRect(x, y - 5, w, 10);
      ctx.globalCompositeOperation = "source-over";
    };

    const igniteTarget = () => {
      const el = document.querySelector<HTMLElement>("[data-signal-target]");
      if (!el) return;
      // Imperative by design: a decorative, rAF-timed cue on a server-rendered
      // sibling. `.signal-ignite` is hand-written CSS in globals.css (a
      // JS-applied Tailwind class would be purged).
      el.classList.remove("signal-ignite");
      void el.offsetWidth; // restart the animation if it's mid-flight
      el.classList.add("signal-ignite");
      window.setTimeout(() => el.classList.remove("signal-ignite"), 1000);
    };

    return mountField(
      canvas,
      {
        layout(fc, prev) {
          measureTarget(fc);
          if (!ps.length) {
            build(fc);
          } else if (prev.width > 0 && prev.height > 0) {
            // Rescale in place rather than rebuilding: the hero resizes on its
            // own as the display webfont swaps in, and a rebuild mid-sequence
            // reads as a visible restart.
            const sx = fc.width / prev.width;
            const sy = fc.height / prev.height;
            for (const p of ps) {
              p.x *= sx;
              p.y *= sy;
            }
          }
        },

        reset(fc) {
          measureTarget(fc);
          flashFired = false;
          nextIgnite = 0;
          introDelivered = false;
          pendingDeliveries = [];
          for (let i = 0; i < ps.length; i += 1) {
            const slot = ps[i].slot;
            spawn(ps[i], i, fc);
            ps[i].slot = slot;
          }
        },

        draw(fc, t, dt, now) {
          const { ctx, width, height, palette } = fc;
          ctx.strokeStyle = palette.gold;
          ctx.lineCap = "round";

          if (t < T_NOISE) {
            // ---- 1. NOISE: chaotic drift, fading up out of the dark
            const k = easeOut(clamp01(t / 780));
            for (const p of ps) {
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              p.rot += p.vrot * dt;
              if (p.x < -80) p.x = width + 80;
              else if (p.x > width + 80) p.x = -80;
              if (p.y < -40) p.y = height + 40;
              else if (p.y > height + 40) p.y = -40;
              blit(
                ctx,
                fc.ink[p.sprite],
                p.x,
                p.y,
                p.alpha * k * 0.5 * readingClarity(p.x, p.y, fc),
                p.rot
              );
            }
          } else if (t < T_PULL) {
            // ---- 2. PULL: a vortex drags everything into the core; the text
            // dissolves into pure motion as it accelerates.
            const u = clamp01((t - T_NOISE) / (T_PULL - T_NOISE));
            const grip = easeIn(u);
            ctx.lineWidth = 1;
            for (const p of ps) {
              if (p.consumed) continue;
              const dx = coreX - p.x;
              const dy = coreY - p.y;
              const d = Math.hypot(dx, dy) || 1;
              const accel = (0.34 + 26 / d) * grip;
              const swirl = 0.5 * grip * (1 - u * 0.7);
              p.vx += ((dx / d) * accel + (-dy / d) * swirl * 0.4) * dt;
              p.vy += ((dy / d) * accel + (dx / d) * swirl * 0.4) * dt;
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              if (d < CORE_RADIUS) {
                p.consumed = true;
                continue;
              }
              blit(ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * (1 - u) * 0.5, p.rot);
              drawStreak(ctx, p, p.alpha * grip * 0.55, 2.6 + grip * 5);
            }
            // Core builds pressure before it lets go.
            ctx.globalCompositeOperation = "lighter";
            const preR = 4 + grip * 26;
            const pre = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, preR);
            pre.addColorStop(0, palette.gold);
            pre.addColorStop(1, "transparent");
            ctx.globalAlpha = 0.5 * grip;
            ctx.fillStyle = pre;
            ctx.fillRect(coreX - preR, coreY - preR, preR * 2, preR * 2);
            ctx.globalCompositeOperation = "source-over";
          } else if (t < T_SETTLE) {
            // ---- 3. FLASH + RESOLVE: survivors re-form as one line of signal
            if (!flashFired) {
              flashFired = true;
              igniteTarget();
            }

            const r = clamp01((t - T_PULL) / (T_RESOLVE - T_PULL));
            const settle = clamp01((t - T_RESOLVE) / (T_SETTLE - T_RESOLVE));
            const ease = easeOut(r);
            const slots = Math.min(SIGNAL_COUNT, ps.length);

            ctx.lineWidth = 1;
            for (const p of ps) {
              if (p.slot >= 0) {
                // Survivors: fly from the core out onto the signal line.
                const tx = lineX + (lineW * (p.slot + 0.5)) / slots;
                const ty = coreY + 4;
                p.x = coreX + (tx - coreX) * ease;
                p.y = coreY + (ty - coreY) * ease;
                const a = ease * (1 - settle) * 0.9;
                if (a > 0.004) {
                  ctx.globalCompositeOperation = "lighter";
                  ctx.globalAlpha = a;
                  ctx.fillStyle = palette.gold;
                  ctx.fillRect(p.x - 1, p.y + settle * 14 - 1.5, 2, 3);
                  ctx.globalCompositeOperation = "source-over";
                }
              } else if (!p.consumed) {
                // Stragglers keep falling in.
                const dx = coreX - p.x;
                const dy = coreY - p.y;
                const d = Math.hypot(dx, dy) || 1;
                p.vx += (dx / d) * 0.5 * dt;
                p.vy += (dy / d) * 0.5 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (d < CORE_RADIUS) p.consumed = true;
                else drawStreak(ctx, p, 0.4 * (1 - r), 5);
              }
            }

            const f = clamp01((t - T_PULL) / FLASH_MS);
            if (f < 1) drawFlash(fc, f);
            drawSignalLine(fc, ease, (1 - settle) * 0.85, settle * 14);
          } else {
            // ---- 4. AMBIENT: a calm full-height field. Every few seconds one
            // fragment — the word paired to the next feed finding — ignites
            // gold and arcs into the feed panel; crossing the window boundary
            // queues a delivery, and the feed births the matching entry.

            // Pump queued deliveries. Dispatching from draw() means delivery
            // dies with the rAF loop — nothing fires after unmount or in a
            // hidden tab.
            for (let i = pendingDeliveries.length - 1; i >= 0; i -= 1) {
              if (pendingDeliveries[i].at <= now) {
                const d = pendingDeliveries.splice(i, 1)[0];
                emitSignalDelivery({ findingIndex: d.findingIndex, kind: d.kind });
              }
            }

            if (nextIgnite === 0) {
              nextIgnite = now + 1800;
              ambientStart = t;
              // Recycle everything across the FULL field once the sequence
              // ends — the bottom half stays alive; the opaque window occludes
              // the middle. A slight upward bias reads as "still gathering."
              for (let i = 0; i < ps.length; i += 1) {
                const p = ps[i];
                spawn(p, i, fc);
                p.slot = -1;
                p.vy -= 0.05;
                p.alpha *= 0.62;
              }
              // The intro's absorption lands its row now — ambient entry is
              // the moment the sunken line disappears into the window.
              if (!introDelivered) {
                introDelivered = true;
                queueDelivery(now + 150, "collapse");
              }
            }
            // The recycled field fades up instead of popping in.
            const ambientRamp = clamp01((t - ambientStart) / 800);

            if (now > nextIgnite) {
              // Each ignition births a feed row, so the cadence is the feed's
              // update rate — slower than a pure decorative flare would be.
              nextIgnite = now + 4500 + Math.random() * 3500;
              // Reject candidates behind the window: an occluded ignition is
              // an invisible cause for the row that then appears.
              for (let tries = 0; tries < 8; tries += 1) {
                const pick = ps[Math.floor(Math.random() * ps.length)];
                if (pick.ignitedAt !== 0) continue;
                const hidden =
                  pick.x > winLeft &&
                  pick.x < winRight &&
                  pick.y > winTop &&
                  pick.y < winBottom;
                if (hidden) continue;
                // Content pairing: flare the exact word this finding was
                // distilled from, so cause and entry match.
                pick.sprite = FINDING_FRAGMENT_INDEX[nextFindingIndex];
                pick.ix = pick.x;
                pick.iy = pick.y;
                pick.bend = (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.14);
                pick.ignitedAt = now;
                pick.crossed = false;
                break;
              }
            }

            ctx.lineWidth = 1;
            for (let i = 0; i < ps.length; i += 1) {
              const p = ps[i];

              if (p.ignitedAt > 0) {
                // Fixed-duration bezier flight into the feed panel: arrival is
                // guaranteed, so delivery timing is exact. The window occludes
                // the final approach — the fragment visibly dives INTO it.
                const k = clamp01((now - p.ignitedAt) / FLIGHT_MS);
                const e = easeIn(k);
                const u = 1 - e;
                const mx = (p.ix + feedX) / 2 - (feedY - p.iy) * p.bend;
                const my = (p.iy + feedY) / 2 + (feedX - p.ix) * p.bend;
                const px = p.x;
                const py = p.y;
                p.x = u * u * p.ix + 2 * u * e * mx + e * e * feedX;
                p.y = u * u * p.iy + 2 * u * e * my + e * e * feedY;
                // Frame delta doubles as the streak direction.
                p.vx = p.x - px;
                p.vy = p.y - py;

                const flare = clamp01((now - p.ignitedAt) / 120);
                blit(ctx, fc.gold[p.sprite], p.x, p.y, flare * 0.9, p.rot);
                drawStreak(ctx, p, flare * 0.45, 4);

                const inside =
                  p.x > winLeft &&
                  p.x < winRight &&
                  p.y > winTop &&
                  p.y < winBottom;
                if (!p.crossed && inside) {
                  p.crossed = true;
                  // Small lag sells "it traveled inside to the feed."
                  queueDelivery(now + 120, "ambient");
                }
                if (k >= 1) {
                  // Fallback geometry (no window rect): deliver on arrival.
                  if (!p.crossed) queueDelivery(now, "ambient");
                  const keep = p.alpha;
                  spawn(p, i, fc);
                  p.alpha = keep;
                  p.vy -= 0.05;
                }
                continue;
              }

              p.x += p.vx * 0.55 * dt;
              p.y += p.vy * 0.55 * dt;
              p.rot += p.vrot * dt;
              if (p.x < -80) p.x = width + 80;
              else if (p.x > width + 80) p.x = -80;
              if (p.y < -40) p.y = height + 40;
              else if (p.y > height + 40) p.y = -40;
              // Quieter below the window so the marquee keeps the floor.
              const below = p.y > winBottom && winBottom > 0 ? 0.75 : 1;
              blit(
                ctx,
                fc.ink[p.sprite],
                p.x,
                p.y,
                p.alpha * 0.24 * below * ambientRamp * readingClarity(p.x, p.y, fc),
                p.rot
              );
            }

            drawSignalLine(fc, 1, 0.16, 0);
          }
        },

        /**
         * Single settled frame for reduced-motion users. They still get the
         * idea — a field of noise above one resolved line of signal — just
         * without any of the movement. Rendered heavier than the ambient loop
         * precisely because it's the only frame they ever see.
         */
        still(fc) {
          // Full field, not just the upper half — the window occludes the
          // middle, and the ambient loop now lives at full height too.
          for (const p of ps) {
            blit(
              fc.ctx,
              fc.ink[p.sprite],
              p.x,
              p.y,
              p.alpha * 0.34 * readingClarity(p.x, p.y, fc),
              p.rot
            );
          }
          fc.ctx.globalAlpha = 1;
          drawSignalLine(fc, 1, 0.9, 0);
        },
      },
      { replay: true }
    );
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
