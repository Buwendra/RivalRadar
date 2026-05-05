/**
 * Render-time source quality scoring (Phase 8a).
 *
 * Backend stores citation URLs as-is; the frontend dims/highlights based on
 * a hardcoded reputable-domains list. Cheaper than a domain-authority API,
 * easy to extend, and trivially reversible (changing this list affects only
 * UI rendering, never persisted data).
 *
 * Heuristics:
 *   1. The URL hostname (or any parent suffix) appears in REPUTABLE_DOMAINS → 'high'
 *   2. The URL is the COMPETITOR'S OWN domain (passed in) → 'high' (their own announcement)
 *   3. The URL is a known low-quality pattern (personal social profile, scraper sites) → 'low'
 *   4. Everything else → 'medium'
 */

export type SourceQuality = "high" | "medium" | "low";

/**
 * Tier-1 industry/business news + reputable databases. Append (don't replace)
 * when adding more — the matching logic walks the hostname's suffixes so a
 * `news.bloomberg.com` URL matches `bloomberg.com` automatically.
 */
export const REPUTABLE_DOMAINS: string[] = [
  // General business + tech press
  "techcrunch.com",
  "reuters.com",
  "bloomberg.com",
  "wsj.com",
  "ft.com",
  "nytimes.com",
  "axios.com",
  "theinformation.com",
  "theverge.com",
  "wired.com",
  "economist.com",
  "businessinsider.com",
  "fortune.com",
  "forbes.com",
  "hbr.org",
  "cnbc.com",
  // Industry-specific high-signal
  "venturebeat.com",
  "protocol.com",
  "theblock.co",
  "stratechery.com",
  // Funding + business databases
  "crunchbase.com",
  "pitchbook.com",
  "sec.gov",
  "linkedin.com/company",   // company pages (not personal /in/ profiles)
];

/** Patterns that mark a URL as low-signal regardless of TLD. */
const LOW_QUALITY_PATTERNS: RegExp[] = [
  /linkedin\.com\/in\//i,        // personal LinkedIn profiles
  /twitter\.com\/[^/]+\/?$/i,    // personal Twitter/X profiles (not specific tweets)
  /x\.com\/[^/]+\/?$/i,
  /instagram\.com\/[^/]+\/?$/i,
  /facebook\.com\/[^/]+\/?$/i,
  /reddit\.com\/r\//i,           // Reddit posts — interesting but not citable as authoritative
  /medium\.com\/@/i,             // personal Medium pages (not company pubs)
];

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Score a citation URL. `competitorDomain` (optional) is the hostname of the
 * competitor's own site — citations to their own domain count as 'high'
 * because they're an authoritative first-party announcement.
 */
export function scoreSource(
  url: string,
  competitorDomain?: string
): SourceQuality {
  const host = safeHostname(url);
  if (!host) return "medium";

  // Low-quality patterns first — they trump TLD checks (a personal LinkedIn
  // profile under linkedin.com shouldn't get the company-page free pass).
  for (const pat of LOW_QUALITY_PATTERNS) {
    if (pat.test(url)) return "low";
  }

  // Government domains are always high signal
  if (host.endsWith(".gov")) return "high";

  // Competitor's own domain (their own announcement)
  if (competitorDomain) {
    const compHost = safeHostname(competitorDomain) ?? competitorDomain.toLowerCase();
    if (host === compHost || host.endsWith(`.${compHost}`)) {
      return "high";
    }
  }

  // Reputable-domains list — match hostname OR any parent suffix
  for (const domain of REPUTABLE_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`) || url.includes(domain)) {
      return "high";
    }
  }

  return "medium";
}

/**
 * Deduplicate a citation list by URL, returning each unique URL with the
 * count of times it appeared. Order preserved by first occurrence.
 */
export function dedupeCitations<T extends { url: string }>(
  citations: T[]
): Array<T & { occurrences: number }> {
  const map = new Map<string, T & { occurrences: number }>();
  for (const c of citations) {
    const existing = map.get(c.url);
    if (existing) {
      existing.occurrences += 1;
    } else {
      map.set(c.url, { ...c, occurrences: 1 });
    }
  }
  return Array.from(map.values());
}
