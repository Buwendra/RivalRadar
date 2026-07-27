import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          950: "#0A0F1E",
          900: "#0F1629",
          800: "#1A2342",
          700: "#253262",
          600: "#354780",
        },
        // Warm near-black ladder — public marketing surface only (paired with
        // the .theme-forest semantic-variable override in globals.css). Barely
        // warm rather than pure neutral so the cream and the film grain read
        // warm rather than clinical.
        obsidian: {
          950: "#0E0D0C",
          900: "#161513",
          800: "#201E1B",
          700: "#2E2B27",
          600: "#423E39",
        },
        // Parchment cream — the marketing surface's primary foreground.
        ink: "#E1D9C1",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        significance: {
          low: "#10B981",
          medium: "#EAB308",
          high: "#EF4444",
        },
        // Cream CTA. Gold is imagery-only under this palette, so the primary
        // button is cream-on-near-black (~14:1) rather than an outline — it
        // keeps a strong conversion affordance without reintroducing gold UI.
        cta: {
          DEFAULT: "#E1D9C1",
          hover: "#F0EADA",
          active: "#C7BFA7",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: [
          "var(--font-display)",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
      },
      // ── Editorial type scale ─────────────────────────────────────────
      // One named scale the whole marketing surface composes from, so type
      // hierarchy is a system decision, not a per-page guess. Each entry
      // ships its own line-height + tracking (large display = tight negative
      // tracking; labels = wide positive tracking) per editorial craft.
      fontSize: {
        "display-xl": [
          "clamp(2.75rem, 6vw, 5.25rem)",
          { lineHeight: "1.0", letterSpacing: "-0.03em" },
        ],
        "display-l": [
          "clamp(2.25rem, 4.5vw, 3.5rem)",
          { lineHeight: "1.04", letterSpacing: "-0.025em" },
        ],
        "display-m": [
          "clamp(1.75rem, 3vw, 2.5rem)",
          { lineHeight: "1.1", letterSpacing: "-0.02em" },
        ],
        headline: [
          "1.5rem",
          { lineHeight: "1.2", letterSpacing: "-0.015em" },
        ],
        title: ["1.1875rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        standfirst: [
          "clamp(1.125rem, 1.5vw, 1.375rem)",
          { lineHeight: "1.55", letterSpacing: "-0.01em" },
        ],
        "body-lg": ["1.0625rem", { lineHeight: "1.7" }],
        label: [
          "0.75rem",
          { lineHeight: "1", letterSpacing: "0.14em" },
        ],
      },
      transitionTimingFunction: {
        "out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out-strong": "cubic-bezier(0.77, 0, 0.175, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "aurora-drift": {
          "0%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(60px, -40px, 0) scale(1.15)" },
          "100%": { transform: "translate3d(-40px, 30px, 0) scale(0.95)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        // Hairline rule that draws in from the left — the editorial section
        // divider. transform-only so it's GPU-cheap.
        "rule-draw": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        aurora: "aurora-drift 26s ease-in-out infinite alternate",
        "fade-up": "fade-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.5s ease-out both",
        marquee: "marquee 50s linear infinite",
        "rule-draw":
          "rule-draw 0.7s cubic-bezier(0.77, 0, 0.175, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
