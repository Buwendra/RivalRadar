/**
 * Single source of truth for how RivalScan's scores are explained to users.
 *
 * The /dashboard/methodology page renders the full set; the inline ⓘ score
 * explainers (`<ScoreInfo metric="…" />`) render `oneLiner` + a deep link to
 * `/dashboard/methodology#<anchor>`. Keeping both surfaces fed from this one
 * module means the page and the tooltips can never drift apart.
 *
 * Content mirrors the backend formulas verbatim:
 *   - momentum buckets      → shared/utils/competitor-metrics.ts
 *   - brand health + conf.  → shared/utils/brand-health.ts
 *   - share of voice        → shared/utils/share-of-voice.ts
 *   - threat rubric         → shared/services/anthropic.ts (scoreCompetitorThreat)
 *   - significance + alerts → shared/services/anthropic.ts + pipeline/send-alert.ts
 * When a formula changes, update it here in the same commit.
 */

export type MetricKey =
  | "threat"
  | "momentum"
  | "significance"
  | "brandHealth"
  | "shareOfVoice"
  | "confidence"
  | "signals";

/** How a metric is produced — drives the small provenance badge. */
export type MetricProvenance =
  | "Rule-based"
  | "AI model · fixed rubric"
  | "AI model · per change"
  | "Standard marketing metric";

export interface RubricRow {
  /** Left cell — the label/level/range. */
  label: string;
  /** Right cell — what it means / the rule. */
  detail: string;
}

export interface MetricDoc {
  key: MetricKey;
  /** URL fragment for deep-linking from the ⓘ tooltips. */
  anchor: string;
  title: string;
  provenance: MetricProvenance;
  /** One-sentence summary shown in the inline tooltip. */
  oneLiner: string;
  /** Optional formula, shown in a mono block on the page. */
  formula?: string;
  /** Optional rubric / lookup table. */
  rubric?: RubricRow[];
  /** Extra prose bullets shown under the table on the page. */
  notes?: string[];
}

export const METHODOLOGY: MetricDoc[] = [
  {
    key: "threat",
    anchor: "threat-level",
    title: "Threat level",
    provenance: "AI model · fixed rubric",
    oneLiner:
      "How directly and urgently a competitor competes with you — assigned by an AI model against a fixed rubric.",
    rubric: [
      {
        label: "Critical",
        detail:
          "Direct competitor in your segment, currently rising, with a recent major move (launch / pricing / funding / acquisition).",
      },
      {
        label: "High",
        detail:
          "Direct competitor, or any rival that made a major strategic move in the last 30 days.",
      },
      { label: "Medium", detail: "Adjacent threat with notable activity." },
      { label: "Low", detail: "Adjacent / tangential, low activity." },
      { label: "Monitor", detail: "Tangential — tracked for awareness only." },
    ],
    notes: [
      "Because it is assigned by an AI model, the threat level is a judgement, not a deterministic calculation — it can shift between research runs as the evidence changes.",
    ],
  },
  {
    key: "momentum",
    anchor: "momentum",
    title: "Momentum",
    provenance: "Rule-based",
    oneLiner:
      "The direction of a competitor's activity — the most recent 7 days of detected changes vs. a smoothed prior baseline.",
    formula: "change% = (last 7 days − average prior week) ÷ (average prior week + 2)",
    rubric: [
      { label: "Rising", detail: "≥ +25%" },
      { label: "Stable", detail: "−15% to +25%" },
      { label: "Slowing", detail: "−40% to −15%" },
      { label: "Declining", detail: "< −40%" },
      {
        label: "Insufficient data",
        detail: "Fewer than 14 days of history, or fewer than 3 changes in the window.",
      },
    ],
    notes: [
      "The prior baseline is the average weekly activity over the rest of the window, with light smoothing (the “+2”) so a very small baseline can't turn a normal week into a wild percentage.",
      "Momentum measures the volume of detected activity, not whether that activity is good or bad for the competitor.",
    ],
  },
  {
    key: "significance",
    anchor: "significance",
    title: "Significance",
    provenance: "AI model · per change",
    oneLiner:
      "How strategically material a single detected change is, scored 1–10 by an AI model.",
    rubric: [
      { label: "1–3", detail: "Minor — routine blog or social post." },
      { label: "4–6", detail: "Notable — product update, mid-size hire, positive press." },
      {
        label: "7–10",
        detail: "Strategic — pricing change, major launch, funding round, key exec move, acquisition.",
      },
    ],
    notes: [
      "Email alerts are sent for changes scoring 7 or higher; the most urgent (8+) trigger a real-time notification.",
    ],
  },
  {
    key: "brandHealth",
    anchor: "brand-health",
    title: "Brand Health Score",
    provenance: "Rule-based",
    oneLiner:
      "A 0–100 read on how the market is covering your brand — a blend of sentiment, share of voice, and momentum.",
    formula: "score = round((sentiment + voice + momentum) ÷ 3)",
    rubric: [
      {
        label: "Sentiment",
        detail:
          "50 + 50 × (positive − negative) ÷ total mentions, over the last 4 weeks (50 neutral, 100 all-positive, 0 all-negative). Small samples are shrunk toward 50 so a couple of mentions can't swing the score to an extreme.",
      },
      {
        label: "Voice",
        detail:
          "Your share of all workspace coverage over the last 4 weeks (the same number as your overall Share of Voice).",
      },
      {
        label: "Momentum",
        detail: "Mapped to a score: rising 80 · stable 60 · slowing 40 · declining 20 · insufficient-data 50.",
      },
    ],
    notes: [
      "The three components are equally weighted. It is an internal indicator of coverage health, not an externally certified brand index.",
    ],
  },
  {
    key: "shareOfVoice",
    anchor: "share-of-voice",
    title: "Share of Voice",
    provenance: "Standard marketing metric",
    oneLiner:
      "Each tracked entity's share of all detected changes in the window — overall and by category.",
    formula: "share% = your changes ÷ all tracked changes",
    notes: [
      "Your own brand ranks honestly against competitors — it is never floated to the top.",
      "Counts are of detected changes, not audience-weighted impressions, so treat it as a directional signal of who is generating the most activity.",
    ],
  },
  {
    key: "confidence",
    anchor: "confidence",
    title: "Confidence",
    provenance: "Rule-based",
    oneLiner:
      "How much data a score rests on — a low/medium/high flag based on mention volume, not on how good the score is.",
    formula: "min(sentiment mentions, voice mentions)",
    rubric: [
      { label: "High", detail: "20 or more mentions." },
      { label: "Medium", detail: "5–19 mentions." },
      { label: "Low", detail: "Fewer than 5 mentions." },
    ],
  },
  {
    key: "signals",
    anchor: "signals",
    title: "Per-finding signals",
    provenance: "AI model · per change",
    oneLiner:
      "Each research finding is tagged with importance, sentiment, and time-sensitivity, plus a derived posture for the competitor.",
    rubric: [
      { label: "Importance (1–3)", detail: "How strategically material the finding is (3 = most)." },
      { label: "Sentiment", detail: "External tone of the coverage — positive / neutral / negative (not our opinion)." },
      { label: "Time-sensitivity", detail: "How time-bound the fact is — breaking / recent / historical." },
      {
        label: "Derived state",
        detail:
          "The competitor's posture across stage, funding, hiring, strategic direction, tech positioning, and pacing.",
      },
    ],
  },
];

export function getMetricDoc(key: MetricKey): MetricDoc | undefined {
  return METHODOLOGY.find((m) => m.key === key);
}

/** Path to the metric's section on the methodology page. */
export function methodologyHref(key: MetricKey): string {
  const doc = getMetricDoc(key);
  return `/dashboard/methodology${doc ? `#${doc.anchor}` : ""}`;
}
