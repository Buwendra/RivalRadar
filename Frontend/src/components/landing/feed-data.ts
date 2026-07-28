import { FRAGMENTS } from "./signal-runtime";

/**
 * Shared contract between the hero's SignalCollapse canvas and the LiveFeed
 * mockup. The canvas decides when a finding "arrives" (the intro collapse, and
 * each ambient ignition streaking into the dashboard) and dispatches a
 * delivery event; the feed inserts that finding at the top with a gold
 * materialize flash. Keeping the data + event names here lets both sides stay
 * decoupled while agreeing on the sequence.
 *
 * All companies and findings are fictional; the feed illustrates the real
 * product surface (category, significance score, same-day detection).
 */
export interface Finding {
  company: string;
  category: string;
  significance: number;
  text: string;
  time: string;
  /**
   * The FRAGMENTS word that ignites gold and streaks into the dashboard just
   * before this finding appears — the visible "raw noise" this entry was
   * distilled from. Typed against the atlas list so a typo won't compile.
   */
  fragment: (typeof FRAGMENTS)[number];
}

export const FINDINGS: Finding[] = [
  {
    company: "Acme Analytics",
    category: "Product",
    significance: 8,
    text: "Launched usage-based pricing for their enterprise tier",
    time: "2m ago",
    fragment: "pricing updated",
  },
  {
    company: "Northwind",
    category: "Funding",
    significance: 9,
    text: "Raised a $12M Series A to expand into EMEA",
    time: "14m ago",
    fragment: "funding round",
  },
  {
    company: "BoldMetrics",
    category: "Hiring",
    significance: 6,
    text: "Posted 4 senior enterprise sales roles this week",
    time: "31m ago",
    fragment: "VP Sales req",
  },
  {
    company: "Acme Analytics",
    category: "News",
    significance: 5,
    text: "Featured in a major SMB tools roundup",
    time: "1h ago",
    fragment: "press release",
  },
  {
    company: "Vantage Labs",
    category: "Social",
    significance: 4,
    text: "Spike in engagement on AI-positioning posts",
    time: "2h ago",
    fragment: "Reddit thread",
  },
  {
    company: "Northwind",
    category: "Product",
    significance: 7,
    text: "Shipped a Slack integration for deal alerts",
    time: "3h ago",
    fragment: "new integration",
  },
];

/** Atlas index per finding, resolved once. The typing above makes -1 impossible. */
export const FINDING_FRAGMENT_INDEX: number[] = FINDINGS.map((f) =>
  Math.max(
    0,
    FRAGMENTS.findIndex((word) => word === f.fragment)
  )
);

export const SIGNAL_DELIVERY_EVENT = "kx-signal-delivery";

export interface SignalDeliveryDetail {
  findingIndex: number;
  /** Intro collapse absorption vs. an ambient ignition arrival. */
  kind: "collapse" | "ambient";
}

declare global {
  interface WindowEventMap {
    "kx-signal-delivery": CustomEvent<SignalDeliveryDetail>;
  }
}

export function emitSignalDelivery(detail: SignalDeliveryDetail): void {
  window.dispatchEvent(
    new CustomEvent<SignalDeliveryDetail>(SIGNAL_DELIVERY_EVENT, { detail })
  );
}
