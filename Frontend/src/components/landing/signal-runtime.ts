/**
 * Shared runtime for the marketing "signal field" motion system.
 *
 * Every animated background on the public surface — the hero collapse, the
 * unresolved noise behind the problem statement, the how-it-works conduit, the
 * footer convergence — runs on this. It owns the boring, easy-to-get-wrong
 * parts so each effect only has to describe its own physics:
 *
 *   - one shared sprite atlas per color, built once for the whole page
 *   - DPR-correct sizing, ResizeObserver, in-place rescale (never a rebuild)
 *   - rAF paused off-screen and in background tabs
 *   - `prefers-reduced-motion` served a single still frame, never a loop
 *   - a frame-rate-independent `dt`, clamped so a backgrounded tab can't
 *     teleport a simulation on return
 *
 * Colors are read from the live `.theme-forest` custom properties, so changing
 * a brand token updates every effect without touching this file.
 */

/** Generic industry chatter — decorative texture, not claims about anyone. */
export const FRAGMENTS = [
  "Series B",
  "$40M raised",
  "hiring 12 SDRs",
  "changelog v4.2",
  "pricing updated",
  "G2 review",
  "TechCrunch",
  "VP Sales req",
  "roadmap leak",
  "SOC 2 Type II",
  "churn spike",
  "new integration",
  "ARR $8M",
  "product launch",
  "Reddit thread",
  "case study",
  "partnership",
  "patent filed",
  "office: Berlin",
  "API v3",
  "enterprise tier",
  "teardown",
  "NPS 42",
  "rebrand",
  "acquisition",
  "beta waitlist",
  "SDK release",
  "press release",
  "HN front page",
  "status incident",
  "docs update",
  "careers page",
  "earnings call",
  "analyst note",
  "customer win",
  "webinar",
  "job req: RevOps",
  "podcast",
  "quarterly update",
  "funding round",
] as const;

const SPRITE_FONT =
  '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

/**
 * Atlases are cached at module scope and keyed by color: a page with five
 * fields builds two atlases total, not ten. Rasterizing once means the render
 * loops only ever call drawImage, never fillText.
 */
const atlasCache = new Map<string, Sprite[]>();

export function getAtlas(color: string): Sprite[] {
  const cached = atlasCache.get(color);
  if (cached) return cached;

  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const built = FRAGMENTS.map((text) => {
    const c = document.createElement("canvas");
    const g = c.getContext("2d");
    if (!g) return { canvas: c, w: 1, h: 1 };
    g.font = SPRITE_FONT;
    const w = Math.ceil(g.measureText(text).width) + 8;
    const h = 18;
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    // Resizing resets the context — re-apply everything after it.
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.font = SPRITE_FONT;
    g.fillStyle = color;
    g.textBaseline = "middle";
    g.fillText(text, 4, h / 2);
    return { canvas: c, w, h };
  });

  atlasCache.set(color, built);
  return built;
}

export interface Palette {
  gold: string;
  ink: string;
}

/**
 * Reads colors off the live theme.
 *
 * `gold` comes from `--glow`, NOT `--primary`. Under the cream-on-black
 * palette the UI accent is parchment cream and warm gold survives only as
 * light inside imagery — which is exactly what these fields are. Falling back
 * to `--primary` keeps this working on any theme that doesn't define `--glow`.
 */
export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => {
    const raw = cs.getPropertyValue(name).trim();
    return raw ? `hsl(${raw})` : fallback;
  };
  return {
    gold: v("--glow", v("--primary", "#F59E0B")),
    ink: v("--foreground", "#E1D9C1"),
  };
}

export interface FieldContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  palette: Palette;
  ink: Sprite[];
  gold: Sprite[];
  /** The element the canvas is sized against — measure siblings relative to it. */
  host: HTMLElement;
}

export interface FieldHooks {
  /**
   * Mount and every resize. `prev` is the previous CSS size ({0,0} on mount),
   * so an effect can rescale its particles in place instead of rebuilding.
   */
  layout(fc: FieldContext, prev: { width: number; height: number }): void;
  /** One animation frame. `t` = ms since (re)start, `dt` normalized to 60fps. */
  draw(fc: FieldContext, t: number, dt: number, now: number): void;
  /** The single frame reduced-motion users see. */
  still(fc: FieldContext): void;
  /** Reset simulation state when the intro replays. */
  reset?(fc: FieldContext): void;
}

export interface MountOptions {
  /** Replay the intro when the section re-enters view after leaving it. */
  replay?: boolean;
  /** Minimum ms between replays. */
  replayCooldown?: number;
  /** Delay the timeline until the host is actually scrolled into view. */
  startInView?: boolean;
}

/**
 * Wires a canvas up to a set of hooks and returns a teardown function.
 * Call from a `useEffect`; the return value is the cleanup.
 */
export function mountField(
  canvas: HTMLCanvasElement,
  hooks: FieldHooks,
  options: MountOptions = {}
): () => void {
  const ctx = canvas.getContext("2d", { alpha: true });
  const host = canvas.parentElement;
  if (!ctx || !host) return () => {};

  const { replay = false, replayCooldown = 9000, startInView = false } = options;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const palette = readPalette(host);

  const fc: FieldContext = {
    ctx,
    width: 0,
    height: 0,
    palette,
    ink: getAtlas(palette.ink),
    gold: getAtlas(palette.gold),
    host,
  };

  let dpr = 1;
  let raf = 0;
  let running = false;
  let started = !startInView;
  let start = performance.now();
  let last = start;
  let lastPlayed = 0;

  const resize = () => {
    const rect = host.getBoundingClientRect();
    const prev = { width: fc.width, height: fc.height };
    fc.width = Math.max(1, Math.round(rect.width));
    fc.height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(fc.width * dpr);
    canvas.height = Math.round(fc.height * dpr);
    canvas.style.width = `${fc.width}px`;
    canvas.style.height = `${fc.height}px`;
    hooks.layout(fc, prev);
  };

  const renderStill = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, fc.width, fc.height);
    hooks.still(fc);
    ctx.globalAlpha = 1;
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // Normalized to 60fps so physics match on 120Hz panels, and clamped so a
    // long background pause doesn't advance the sim by a whole second.
    const dt = Math.min((now - last) / 16.667, 3);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, fc.width, fc.height);
    hooks.draw(fc, now - start, dt, now);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  const stop = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  };

  const play = () => {
    if (running || motionQuery.matches || !started) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  resize();
  if (motionQuery.matches) renderStill();
  else if (!startInView) {
    lastPlayed = performance.now();
    play();
  }

  const ro = new ResizeObserver(() => {
    resize();
    if (motionQuery.matches) renderStill();
  });
  ro.observe(host);

  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) {
        stop();
        return;
      }
      if (motionQuery.matches) return;
      const now = performance.now();
      if (!started) {
        // First time in view: begin the timeline now, not at page load, so a
        // section below the fold still plays its intro from the top.
        started = true;
        start = now;
        lastPlayed = now;
      } else if (replay && now - lastPlayed > replayCooldown) {
        hooks.reset?.(fc);
        start = now;
        lastPlayed = now;
      }
      play();
    },
    { threshold: 0.05 }
  );
  io.observe(host);

  const onVisibility = () => {
    if (document.hidden) stop();
    else play();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onMotionChange = () => {
    if (motionQuery.matches) {
      stop();
      renderStill();
    } else {
      hooks.reset?.(fc);
      start = performance.now();
      play();
    }
  };
  motionQuery.addEventListener("change", onMotionChange);

  return () => {
    stop();
    ro.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    motionQuery.removeEventListener("change", onMotionChange);
  };
}

// --- small shared helpers ---------------------------------------------------

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;

/** Draws an atlas sprite centered at (x, y). */
export function blit(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  alpha: number,
  rot = 0
) {
  if (alpha <= 0.004) return;
  ctx.globalAlpha = alpha;
  if (Math.abs(rot) < 0.01) {
    ctx.drawImage(sprite.canvas, x - sprite.w / 2, y - sprite.h / 2, sprite.w, sprite.h);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
  ctx.restore();
}
