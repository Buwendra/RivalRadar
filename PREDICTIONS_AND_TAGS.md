# Predictions & Tags — Ideation

Internal strategy doc. What derived intelligence can we extract from the data we already collect, and which layers are worth building first.

---

## 1. Why this exists

Today the pipeline produces two raw artifacts per competitor:

- **`ResearchFinding`** — 5 categorized buckets (news / product / funding / hiring / social), each a list of `FindingItem { title, detail, sourceUrl, importance: 1-3 }`, plus `citations[]` and `searchQueries[]`. Defined at [Backend/src/shared/types/research.ts](Backend/src/shared/types/research.ts).
- **`Change`** — Delta record with `significance: 1-10`, `aiAnalysis { changeType, summary, significanceScore, strategicImplication, recommendedAction }`, optional `researchId` + `citations`. Defined at [Backend/src/shared/types/change.ts](Backend/src/shared/types/change.ts).

That's good raw material, but users still do all the synthesis in their heads. Every time a founder opens the app, their actual question isn't *"what are the 30 findings about Stripe?"* — it's one of:

- *"Who should I worry about this week?"* (prioritization across competitors)
- *"Are they winning or losing right now?"* (velocity read)
- *"What are they about to do?"* (forward-looking signal)
- *"How do they stack up against the others I track?"* (comparative ranking)
- *"What's the one thing I need to act on today?"* (reduction to action)

None of those are answered by raw findings. They're all **derived intelligence** — composite scores, predictions, and auto-applied tags that collapse dozens of data points into a single readable signal. That's what this doc proposes.

---

## 2. Who benefits

The three personas from the original plan and what they can't ask today:

| Persona | Their real question | What we give them today | Gap |
|---|---|---|---|
| SaaS founder | "Which competitor is the biggest threat right now?" | Full research + change feeds per competitor | No cross-competitor ranking, no threat score |
| Marketing lead | "What messaging/positioning are they pushing?" | Raw messaging findings | No trend detection, no "going upmarket" tag |
| E-commerce op | "Are they about to price-drop?" | Past pricing changes as `changeType: 'pricing'` | No forward-looking probability |

All three personas ultimately want **one glance, one decision**. Tags and predictions are the mechanism.

---

## 3. Predictions — the "what might happen" layer

For each prediction: **what it answers → inputs → output shape → user value → feasibility**.

### Tier A — MVP (buildable on current data, highest ROI)

#### A1. Competitive threat level

| | |
|---|---|
| What it answers | "Which competitor do I need to watch most closely?" |
| Inputs | Last-30d Change count, high-significance ratio (sig ≥ 7), recent pricing/feature moves, funding signals, hiring velocity, recency-weighted |
| Output | `'critical' \| 'high' \| 'medium' \| 'low' \| 'monitor'` + 1-2 sentence rationale |
| User value | The single most important number. Drives attention across the dashboard. Lets us rank competitor cards. |
| Feasibility | Claude inline (include in `detectResearchDeltas` prompt) OR separate Haiku pass over latest findings. Cheap either way. |

#### A2. Momentum direction

| | |
|---|---|
| What it answers | "Are they gaining or losing momentum right now?" |
| Inputs | Week-over-week significant-finding count, press mention velocity, sentiment trend |
| Output | `'rising' \| 'stable' \| 'slowing' \| 'declining'` + arrow indicator |
| User value | Forward-looking. Pairs naturally with threat level. Rising + critical = red alert; declining + low = you've already won. |
| Feasibility | Pure rule-based computation over historical `Change.detectedAt` counts. Zero AI cost. Needs ≥ 3 weeks of data to work well — before that, display "Insufficient data". |

#### A3. Predicted next move

| | |
|---|---|
| What it answers | "What are they about to do next?" |
| Inputs | Current ResearchFinding + the last 2-3 findings (trend) + competitor's stated strategy if captured |
| Output | Top 3 predictions, each `{ move, probability: 0-1, reasoning, timeHorizon: '30d' \| '60d' \| '90d' }` |
| User value | The highest wow-factor feature. Makes RivalScan feel clairvoyant. Directly answers the founder's "what's coming?" question. |
| Feasibility | Needs dedicated Sonnet call (adds ~$0.02/competitor/research). Structured JSON output. Can skip first-run competitors. |

#### A4. Pricing change probability

| | |
|---|---|
| What it answers | "Are they about to change their pricing?" |
| Inputs | Recent `changeType: 'pricing'` history, pricing-category findings, competitor segment pricing moves, discount messaging signals |
| Output | `probability: 0-1` + top 2 supporting signals |
| User value | Arguably the highest-stakes signal for any SaaS/e-commerce user. Lets them reprice proactively or brace the sales team. |
| Feasibility | Claude inline (one line in `detectResearchDeltas` prompt). Refined by rule-based signal count. Could be false-positive-prone; display with explicit "based on N signals" context. |

#### A5. Hiring velocity index

| | |
|---|---|
| What it answers | "Are they scaling up or freezing?" |
| Inputs | Hiring-category finding counts over time, role-level breakdown, direct job posting signals |
| Output | Index `0-100` (percentile across tracked competitors) + trend direction + top hiring functions (sales/eng/ops) |
| User value | Proxy for: resource buildup, talent competition risk, strategic direction (heavy sales = growth mode; heavy engineering = product push). |
| Feasibility | Pure computation. Claude inline for role-function extraction. Needs cross-competitor corpus to compute percentile, which we have. |

### Tier B — Stretch (needs more data or additional Claude passes)

#### B1. Funding / runway signals

| | |
|---|---|
| What it answers | "Are they about to raise? Running out of money?" |
| Inputs | Funding-category findings, hiring patterns (accelerating = runway healthy, freezing = possible shortage), press chatter |
| Output | Two separate signals: `fundingProbability: 0-1 (next 6mo)` and `runwayConcern: 'healthy' \| 'watch' \| 'critical' \| 'unknown'` |
| User value | Huge for timing competitive moves. A raising competitor is about to 10x marketing; a runway-low competitor is about to cut scope. |
| Feasibility | Claude dedicated pass. Quality heavily depends on data availability — private co's often have thin signals. Must express uncertainty in output. |

#### B2. Market expansion signal

| | |
|---|---|
| What it answers | "Are they expanding into new markets or geos?" |
| Inputs | Hiring location data, press mentions of new regions, localization/translation signals, compliance mentions (GDPR, SOC2) |
| Output | `{ expanding: boolean, direction: 'geo' \| 'segment' \| 'vertical', specifics: string[] }` |
| User value | Critical for anyone operating regionally. Lets the user reinforce defenses before the competitor lands. |
| Feasibility | Claude inline, but quality depends on research quality picking up geo signals. Consider adding an explicit "new markets" search query in `deepResearch`. |

#### B3. Product pivot probability

| | |
|---|---|
| What it answers | "Are they drifting away from their core positioning?" |
| Inputs | Messaging changes over time (changeType: 'messaging'), new feature category launches, hiring in adjacent domains |
| Output | `probability: 0-1` + detected from/to positioning |
| User value | Pivots are existential events. Catching one 3 months early is a substantial strategic advantage. |
| Feasibility | Needs 3+ research snapshots to compute reliably. Claude dedicated pass. Worth building only after Tier A is live. |

#### B4. Customer sentiment trend

| | |
|---|---|
| What it answers | "Are their customers happy? Is their reputation trending up or down?" |
| Inputs | Social-category findings, press sentiment, review-site mentions (if we add them) |
| Output | Sentiment score `-1 to +1`, direction, sample quotes |
| User value | Their weakness is your opportunity. Lets sales teams target unhappy cohorts. |
| Feasibility | Requires richer social data than `deepResearch` gathers today. Consider adding Reddit/Twitter-specific searches. Claude inline sentiment tagging. |

#### B5. M&A activity likelihood

| | |
|---|---|
| What it answers | "Are they about to acquire / be acquired?" |
| Inputs | Press rumors, exec movements, funding signals, industry consolidation patterns |
| Output | `{ likelihood: 'low' \| 'watching' \| 'active', role: 'acquirer' \| 'target' \| 'unknown', evidence: string[] }` |
| User value | Industry-shifting event. Knowing in advance of a public announcement is a several-month lead. |
| Feasibility | Very noisy signal. Rarely high-confidence. Best implemented as "watching"/"active" flag rather than probability. |

### Tier C — Aspirational (longer horizon)

- **Win/loss probability per deal** — if we had the user's own deal data, we could predict "will you win against X this quarter". Requires CRM integration.
- **Churn risk on YOUR customers from THEIR marketing** — if a competitor starts heavy ABM against your segment, flag it.
- **Press narrative drift** — "how is the press framing them this quarter vs last?". Needs NLP on article bodies, not just titles.

Don't prioritize these until Tier A is shipped and validated.

---

## 4. Tags — the "what are they right now" layer

Tags are faster-to-read than predictions. They're single tokens the UI renders as chips. Three surfaces, each with its own taxonomy.

### Per-competitor tags (state of the business)

Applied to the competitor card / header. Updated each research pass. Maximum ~5-6 visible at once.

| Dimension | Vocabulary |
|---|---|
| Stage | `early-stage` / `growth-stage` / `late-stage` / `public` / `declining` |
| Funding | `bootstrapped` / `seed` / `series-a` / `series-b+` / `just-raised` / `runway-low` / `ipo-track` |
| Velocity | `shipping-fast` / `steady` / `slow` / `frozen` |
| Hiring | `hiring-aggressively` / `steady-hire` / `frozen` / `layoffs` |
| Strategy | `going-upmarket` / `going-downmarket` / `expanding-geo` / `expanding-vertical` / `specializing` / `diversifying` |
| Tech positioning | `ai-native` / `ai-adjacent` / `legacy` / `open-source` |
| Market position | `direct-competitor` / `adjacent` / `substitute` / `complement` |
| Momentum | `🚀 rising` / `→ stable` / `⚠️ slowing` / `📉 declining` |

Notes:
- `market-position` is set during onboarding by the user (or inferred by Claude from their company vs competitor profiles). Rarely changes.
- `momentum` is computed from Tier A #2 — the tag is just a rendering of the prediction.
- `funding` has mutually exclusive values (stage) AND additive flags (`just-raised`). Keep them in separate fields internally, merge on render.

### Per-finding tags (extend the existing 5-category bucket)

Applied to each `FindingItem` at research time. Extends the current `importance: 1-3` with richer metadata.

| Dimension | Vocabulary | Notes |
|---|---|---|
| Importance | `1` / `2` / `3` | Already exists |
| Sentiment (for them) | `positive` / `neutral` / `negative` | "Strong funding round" = positive-for-them |
| Time-sensitivity | `breaking` / `recent` / `historical` | `breaking` = <7 days, `recent` = <30 days |
| User-relevance | `direct-impact` / `indirect` / `fyi` | Requires knowing user's own biz; we have `companyName` + `industry` from onboarding |
| Evidence quality | `strong` / `moderate` / `weak` | `strong` = official announcement, `weak` = single tweet. Surfaces uncertainty honestly. |

### Per-change tags (the action layer)

Applied to each `Change` record. Drives email-alert threshold and UI urgency color.

| Tag | Criteria | UI treatment |
|---|---|---|
| `act-now` | significance ≥ 8 OR `changeType: 'pricing'` OR direct threat to user's segment | Red pill, email alert, top-of-feed |
| `plan-response` | significance 6-7, material but not urgent | Amber pill |
| `monitor` | significance 4-5, FYI | Default pill |
| `ignore` | significance ≤ 3, noise | Greyed out, hidden behind "show all" toggle |

The existing `significance` score already encodes intensity. `actionTag` is the categorical collapse of that score PLUS other signals (change type, user-relevance). Adds real value because users can filter "show me act-now only".

---

## 5. Implementation approaches

Three viable techniques. Each prediction/tag should pick one:

| Approach | How | Cost | Best for |
|---|---|---|---|
| **Claude inline** | Include ask in existing `deepResearch` or `detectResearchDeltas` prompt | ~0 (output tokens only) | Tags + binary signals that fit structured JSON. Most Tier A items. |
| **Claude dedicated pass** | Separate call post-research, can use Haiku for cost | $0.01-0.05 per competitor | Richer predictions with reasoning (next-move, M&A), cross-competitor ranking |
| **Rule-based aggregation** | Pure TypeScript over historical findings | $0 | Time-series metrics (momentum, velocity index), categorical collapses, percentile ranking |

**Recommended allocation**:

| Feature | Approach | Why |
|---|---|---|
| A1 Threat level | Claude inline in `detectResearchDeltas` | Already has full finding context; one line added to prompt |
| A2 Momentum | Rule-based | Pure temporal computation, deterministic, free |
| A3 Next move | Dedicated Haiku pass | Needs focused prompt, worth separate call |
| A4 Pricing probability | Claude inline + rule-based signal count | Hybrid; rule catches obvious cases, Claude catches subtle |
| A5 Hiring index | Rule-based percentile + Claude function extraction | Ranking is math; function ("hiring in sales") needs Claude |
| Per-competitor tags | Single dedicated Haiku pass | 10-15 tag decisions in one call, amortizes |
| Per-finding tags | Inline in `deepResearch` prompt | Every finding should be tagged at creation |
| Action tag | Rule-based | Deterministic mapping from significance + changeType |

Net additional AI cost per research run (Tier A fully built): **~$0.05-0.08** on top of existing ~$0.25. Acceptable.

---

## 6. Data model deltas

Additions to support rendering and storage. Keep existing fields untouched so nothing breaks.

### `Competitor` (`Backend/src/shared/types/competitor.ts`)

```typescript
// New optional fields
derivedTags?: string[];                          // The per-competitor tag chips
threatLevel?: 'critical' | 'high' | 'medium' | 'low' | 'monitor';
threatReasoning?: string;                         // 1-2 sentence explanation
momentum?: 'rising' | 'stable' | 'slowing' | 'declining';
momentumChangePercent?: number;                   // e.g. +35 means 35% more findings this week
hiringIndex?: number;                             // 0-100 percentile across user's competitors
pricingChangeProbability?: number;                // 0-1
predictedMoves?: Array<{
  move: string;
  probability: number;                            // 0-1
  reasoning: string;
  timeHorizon: '30d' | '60d' | '90d';
}>;
lastPredictionsAt?: string;                       // ISO timestamp
```

### `FindingItem` (`Backend/src/shared/types/research.ts`)

```typescript
// Add to existing interface
sentiment?: 'positive' | 'neutral' | 'negative';
timeSensitivity?: 'breaking' | 'recent' | 'historical';
userRelevance?: 'direct-impact' | 'indirect' | 'fyi';
evidenceQuality?: 'strong' | 'moderate' | 'weak';
```

### `Change` (`Backend/src/shared/types/change.ts`)

```typescript
// Add to existing interface
actionTag?: 'act-now' | 'plan-response' | 'monitor' | 'ignore';
```

No new DynamoDB entities needed. All fields are attached to existing items. No migration — fields are optional.

### Frontend impact

- New `MetricCard` on competitor Overview tab for **Threat Level** (replaces "High Priority" card, or sits next to it)
- Tag chip row under competitor name in the header
- `ChangeCard` reads `actionTag` for color coding; defaults to old `significance` mapping for backward compat
- Research tab: each `FindingItem` renders a tiny sentiment/quality icon
- Dashboard-wide list of competitors ranks by `threatLevel` desc by default
- New "Predicted moves" card on Overview, collapsed by default

---

## 7. Priority recommendation (what to build first)

If I had one sprint, I'd ship these three and nothing else:

### 1. Threat level + momentum (Tier A #1 + #2)

**Why first**: Highest frequency user question ("who do I worry about?"). Drives re-engagement because it changes week-over-week. Cheap — one Claude line + one rule-based function. Renders as 2 metric cards + sort key for the dashboard list.

### 2. Per-competitor tag chips

**Why second**: Immediate "at-a-glance" readable summary in 5-10 tokens. High-density information. Easy UI win (tag chip component). Single Haiku pass covers it.

### 3. Predicted next move (top 3)

**Why third**: Highest wow-factor. The feature users will screenshot and share. Justifies premium tier pricing. Requires a dedicated prompt but payoff is obvious.

Skip everything else until those are validated with real usage.

---

## 8. Open questions

Flagged for explicit product debate later, not auto-decided:

- **Tier gating**: should threat level + predicted moves be Strategist/Command-only? Strong argument yes (differentiator for paid tiers), weak argument no (these are the "wow" features; withholding them hurts conversion).
- **Cross-competitor benchmarking view**: do we add a dedicated dashboard page that ranks all tracked competitors by threat / momentum / velocity? Useful but needs design work.
- **Weekly digest impact**: should the weekly Sonnet summary email open with the updated tags + predictions? Would massively raise email value but requires coordinated change to `generate-summary.ts` and `render-send-email.ts`.
- **User feedback signal**: `feedbackHelpful` on Change records already exists. Can we feed "was this threat rating right?" feedback back into the prompts? Probably yes, but adds model-drift complexity.
- **Minimum data threshold**: momentum needs 3+ weeks; next-move needs 2+ research runs. What does the UI show before then? Suggest: hide, don't show an empty state, to avoid looking broken.

---

## Appendix: Where these hook into existing code

| Concern | File to modify |
|---|---|
| New tag/prediction prompts | [Backend/src/shared/services/anthropic.ts](Backend/src/shared/services/anthropic.ts) — extend `deepResearch()` and `detectResearchDeltas()` prompts, add new `predictNextMoves()` and `scoreCompetitorTags()` functions |
| Rule-based computation | New file: `Backend/src/shared/utils/competitor-metrics.ts` |
| Lambda orchestration | [Backend/src/functions/pipeline/deep-research.ts](Backend/src/functions/pipeline/deep-research.ts) — call new scoring functions after delta detection, before storing Change records |
| Data model | [Backend/src/shared/types/competitor.ts](Backend/src/shared/types/competitor.ts), [research.ts](Backend/src/shared/types/research.ts), [change.ts](Backend/src/shared/types/change.ts) |
| API response | [Backend/src/functions/api/competitors/get.ts](Backend/src/functions/api/competitors/get.ts) — include new fields in response |
| Frontend types | [Frontend/src/lib/types/](Frontend/src/lib/types/) — mirror backend additions |
| Competitor detail UI | [Frontend/src/app/(dashboard)/dashboard/competitors/[id]/page.tsx](Frontend/src/app/(dashboard)/dashboard/competitors/[id]/page.tsx) — threat-level MetricCard, tag chip row, predictions card |
| Change cards | [Frontend/src/components/dashboard/change-card.tsx](Frontend/src/components/dashboard/change-card.tsx) — read `actionTag` for pill color |
