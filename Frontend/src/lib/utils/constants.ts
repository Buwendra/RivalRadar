export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const APP_NAME = "RivalScan";

// Versioned policies — bump these (and the matching backend constants) when
// you publish a new ToS or Privacy Policy. The frontend sends these on
// signup so the backend can record acceptance against the right version.
export const TOS_VERSION = "2026-04-30";
export const PRIVACY_VERSION = "2026-04-30";

export const PAGE_TYPES = [
  { value: "pricing", label: "Pricing" },
  { value: "features", label: "Features" },
  { value: "homepage", label: "Homepage" },
  { value: "blog", label: "Blog" },
  { value: "careers", label: "Careers" },
] as const;

export const INDUSTRIES = [
  "SaaS / Software",
  "E-commerce / Retail",
  "Fintech",
  "Healthcare",
  "Education",
  "Marketing / Advertising",
  "Media / Entertainment",
  "Real Estate",
  "Travel / Hospitality",
  "Other",
] as const;

export const PLAN_PRICES: Record<string, number> = {
  scout: 49,
  strategist: 99,
  command: 199,
};
