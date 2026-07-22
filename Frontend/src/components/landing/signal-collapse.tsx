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

/**
 * The hero set-piece: the product's job, told as motion.
 *
 * A field of raw web-noise fragments drifts chaotically, then implodes into a
 * single point above the dashboard mockup, flashes, and re-forms as ONE bright
 * line of signal that sinks into the product. Six hundred fragments in, one
 * brief out. After the opening sequence it settles into a calm ambient drift
 * with the occasional fragment igniting and streaking into the dashboard.
 *
 * Shares `signal-runtime` (atlas, palette, loop, reduced-motion handling) with
 * the ambient section fields, but owns its own timeline — this is the only
 * field on the site that tells a beginning-to-end story.
 *
 * The convergence target is whichever element carries `data-signal-target`
 * (the hero mockup). If it isn't present the sequence falls back to a fixed
 * point and still works.
 */

// Sequence timeline, ms from start.
const T_NOISE = 1250; // chaotic drift, fading in
const T_PULL = 2300; // everything accelerates inward, text becomes streaks
const T_RESOLVE = 3300; // survivors form one line of signal
const T_SETTLE = 4500; // the line sinks into the dashboard; ambient takes over

const FLASH_MS = 420;
const SIGNAL_COUNT = 44; // fragments that survive the collapse as signal
const CORE_RADIUS = 26;

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
  /** Timestamp of an ambient-phase ignition, 0 when idle. */
  ignitedAt: number;
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

    const measureTarget = (fc: FieldContext) => {
      const el = document.querySelector<HTMLElement>("[data-signal-target]");
      const hostRect = fc.host.getBoundingClientRect();
      if (el) {
        const r = el.getBoundingClientRect();
        coreX = r.left - hostRect.left + r.width / 2;
        coreY = r.top - hostRect.top - 10;
        lineW = r.width * 0.92;
        lineX = r.left - hostRect.left + (r.width - lineW) / 2;
      } else {
        coreX = fc.width / 2;
        coreY = fc.height * 0.62;
        lineW = Math.min(fc.width * 0.8, 900);
        lineX = (fc.width - lineW) / 2;
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
    };

    const build = (fc: FieldContext) => {
      const target = Math.min(
        620,
        Math.max(90, Math.round((fc.width * fc.height) / 1900))
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
              blit(ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * k * 0.5, p.rot);
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
            // ---- 4. AMBIENT: a calm field, with the odd fragment igniting and
            // streaking into the dashboard. Keeps the hero alive, quietly.
            if (nextIgnite === 0) {
              nextIgnite = now + 1800;
              // Recycle everything into the upper field once the sequence ends.
              for (let i = 0; i < ps.length; i += 1) {
                const p = ps[i];
                spawn(p, i, fc);
                p.slot = -1;
                p.y = Math.random() * Math.max(coreY - 20, height * 0.5);
                p.alpha *= 0.62;
              }
            }
            if (now > nextIgnite) {
              nextIgnite = now + 2200 + Math.random() * 2600;
              const pick = ps[Math.floor(Math.random() * ps.length)];
              if (pick.ignitedAt === 0) pick.ignitedAt = now;
            }

            ctx.lineWidth = 1;
            for (let i = 0; i < ps.length; i += 1) {
              const p = ps[i];

              if (p.ignitedAt > 0) {
                const age = now - p.ignitedAt;
                if (age > 1500) {
                  const keep = p.alpha;
                  spawn(p, i, fc);
                  p.alpha = keep;
                  p.y = Math.random() * Math.max(coreY - 20, height * 0.5);
                  continue;
                }
                const k = clamp01(age / 1500);
                const dx = coreX - p.x;
                const dy = coreY - p.y;
                const d = Math.hypot(dx, dy) || 1;
                p.vx += (dx / d) * 0.34 * dt;
                p.vy += (dy / d) * 0.34 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                blit(ctx, fc.gold[p.sprite], p.x, p.y, (1 - k) * 0.85, p.rot);
                drawStreak(ctx, p, (1 - k) * 0.5, 4);
                continue;
              }

              p.x += p.vx * 0.55 * dt;
              p.y += p.vy * 0.55 * dt;
              p.rot += p.vrot * dt;
              if (p.x < -80) p.x = width + 80;
              else if (p.x > width + 80) p.x = -80;
              if (p.y < -40) p.y = coreY;
              else if (p.y > coreY) p.y = -40;
              blit(ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * 0.24, p.rot);
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
          for (const p of ps) {
            if (p.y > coreY) continue;
            blit(fc.ctx, fc.ink[p.sprite], p.x, p.y, p.alpha * 0.34, p.rot);
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
