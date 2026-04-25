# Roadmap — Predictions & Tags (Priority 3)

Execution-detailed plan to ship the three highest-value intelligence features from [PREDICTIONS_AND_TAGS.md](PREDICTIONS_AND_TAGS.md):

1. **Threat level + momentum** (single most important glance)
2. **Per-competitor tag chips** (at-a-glance state)
3. **Predicted next moves** (forward-looking wow factor)

All three depend on richer research output than we collect today, so Phase 0 enriches the research pipeline first. Each phase stands alone and delivers user-visible value on completion.

---

## Phase structure at a glance

| # | Phase | Depends on | User-visible outcome | Effort |
|---|---|---|---|---|
| 0 | Research prompt enrichment | — | (none — data only) | 0.5 day |
| 1 | Momentum (rule-based) | Phase 0 not strictly needed, but nice | Momentum chip on Overview + sort | 1 day |
| 2 | Threat level (Claude synthesis) | Phase 0 | Threat MetricCard, dashboard sorts by threat | 1 day |
| 3 | Per-competitor tag chips | Phase 0 | Tag row under competitor name | 1 day |
| 4 | Predicted next moves | Phase 0 + ≥ 2 research runs per competitor | "Predicted Moves" card on Overview | 1 day |
| 5 | Cross-competitor dashboard polish | Phases 1-4 | Main dashboard shows ranked competitor strip | 0.5-1 day |

Total: roughly **5 days of focused work**. Each phase ends with a deploy, so partial ship is fine.

---

## Phase 0 — Research prompt enrichment

### Goal
Make `deepResearch()` emit a structured **`derivedState`** block alongside the 5 category arrays. This block summarizes what Claude inferred about the competitor's current state (stage, funding posture, strategic direction, tech positioning, hiring mode) while it already has full research context. Free-ish — adds ~300 tokens of output to the existing call.

Also enrich per-finding metadata with sentiment + time-sensitivity, which Phase 4 (predicted moves) will use for trend detection.

### Why first
- Phases 2 (threat), 3 (tags), 4 (predictions) all lean on this extra signal.
- Zero user-visible change, so it can ship without any frontend work.
- Backfills only incrementally — existing findings stay intact; new runs produce enriched data.

### Research prompt changes

File: `Backend/src/shared/services/anthropic.ts` — function `deepResearch()`.

Append to the existing prompt, immediately before the `{ "summary": ..., "categories": {...} }` JSON shape block:

```
Additionally, populate a "derivedState" block summarizing what you observed:

"derivedState": {
  "stage": "early" | "growth" | "late" | "public" | "declining" | "unknown",
  "fundingState": "bootstrapped" | "recently-raised" | "actively-raising" | "runway-concerns" | "public" | "unknown",
  "hiringState": "aggressive" | "steady" | "slowing" | "frozen" | "layoffs" | "unknown",
  "strategicDirection": "going-upmarket" | "going-downmarket" | "expanding-geo" | "expanding-vertical" | "specializing" | "diversifying" | "steady" | "unknown",
  "techPositioning": "ai-native" | "ai-adjacent" | "legacy" | "open-source" | "mixed" | "unknown",
  "pacing": "shipping-fast" | "steady" | "slow" | "frozen",
  "evidenceNotes": "2-3 sentence justification citing which findings informed these labels"
}

Use "unknown" liberally when evidence is thin. Do NOT guess.
```

Also extend the per-finding JSON shape within the `categories` block:

```
Each finding now includes:
{
  "title": "...",
  "detail": "...",
  "sourceUrl": "...",
  "importance": 1 | 2 | 3,
  "sentiment": "positive" | "neutral" | "negative",    // from competitor's POV
  "timeSensitivity": "breaking" | "recent" | "historical"  // breaking = <7 days, recent = <30 days
}
```

### Data model changes

File: `Backend/src/shared/types/research.ts`

```typescript
// Extend FindingItem
export interface FindingItem {
  title: string;
  detail: string;
  sourceUrl?: string;
  importance: 1 | 2 | 3;
  sentiment?: 'positive' | 'neutral' | 'negative';
  timeSensitivity?: 'breaking' | 'recent' | 'historical';
}

// New type
export interface DerivedState {
  stage: 'early' | 'growth' | 'late' | 'public' | 'declining' | 'unknown';
  fundingState: 'bootstrapped' | 'recently-raised' | 'actively-raising' | 'runway-concerns' | 'public' | 'unknown';
  hiringState: 'aggressive' | 'steady' | 'slowing' | 'frozen' | 'layoffs' | 'unknown';
  strategicDirection: 'going-upmarket' | 'going-downmarket' | 'expanding-geo' | 'expanding-vertical' | 'specializing' | 'diversifying' | 'steady' | 'unknown';
  techPositioning: 'ai-native' | 'ai-adjacent' | 'legacy' | 'open-source' | 'mixed' | 'unknown';
  pacing: 'shipping-fast' | 'steady' | 'slow' | 'frozen';
  evidenceNotes: string;
}

// Extend ResearchFinding
export interface ResearchFinding {
  // ...existing fields
  derivedState?: DerivedState;
}
```

### Backend changes

1. **`Backend/src/shared/services/anthropic.ts`** — `deepResearch()`:
   - Update prompt as above.
   - Extend `sanitizeCategory()` to carry through `sentiment` and `timeSensitivity` with validation.
   - Add `sanitizeDerivedState()` helper that validates all enum values and falls back to `'unknown'`.
   - Return type adds `derivedState`.

2. **`Backend/src/functions/pipeline/deep-research.ts`** — persist `derivedState` on the new `ResearchFinding` item in DynamoDB (no schema change, just another attribute).

3. **`Backend/src/functions/api/competitors/get.ts`** — include `derivedState` in the `recentResearch[]` entries returned (already returning full objects, so this is automatic).

### Frontend changes

None in Phase 0 (intentional — data-only phase).

### Verification

- Deploy Pipeline stack.
- Click **Research Now** on any competitor.
- Query the new ResearchFinding in DynamoDB; confirm `derivedState` populated and no category item is missing sentiment/timeSensitivity.
- Cost check: log `tokensUsed` — expect +300-600 output tokens vs pre-enrichment.

---

## Phase 1 — Momentum (rule-based)

### Goal
Compute `momentum` per competitor from historical finding + Change counts. Surface on Overview tab as a chip + arrow, and sort the main dashboard competitor list by momentum descending. Zero AI cost — pure TypeScript.

### Why this position
- Doesn't need any research-prompt data. Could ship before Phase 0.
- Gives users immediate "is this competitor heating up?" read.
- The sparkline we already render pairs perfectly with it.

### Data model changes

File: `Backend/src/shared/types/competitor.ts`

```typescript
export type Momentum = 'rising' | 'stable' | 'slowing' | 'declining' | 'insufficient-data';

export interface Competitor {
  // ...existing fields
  momentum?: Momentum;
  momentumChangePercent?: number;   // -100..+N, signed
  momentumAsOf?: string;             // ISO timestamp
}
```

### Backend changes

1. **New file: `Backend/src/shared/utils/competitor-metrics.ts`** — pure functions:

   ```typescript
   export function computeMomentum(input: {
     changesByDay: Array<{ date: string; count: number }>;  // 30-day series, already computed in competitor get.ts
     researchTimestamps: string[];                            // ISO timestamps of last 10 ResearchFindings
     now: Date;
   }): { momentum: Momentum; momentumChangePercent: number } {
     // Rule: compare last-7-day findings+changes count to prior-7-day count
     //   change% >= +25  -> 'rising'
     //   change% in [-15, +25] -> 'stable'
     //   change% in [-40, -15) -> 'slowing'
     //   change% <= -40  -> 'declining'
     //   total findings < 3 across 14d -> 'insufficient-data'
   }
   ```

2. **`Backend/src/functions/api/competitors/get.ts`** — call `computeMomentum()` with the stats already computed, and include in response.

3. **Optional batch enrichment**: after each `deep-research.ts` completes, also call `computeMomentum()` and write result to the Competitor record (so list view doesn't recompute per request). Minor optimization; skip if premature.

### Frontend changes

1. **`Frontend/src/lib/types/competitor.ts`** — mirror `Momentum` + new fields on `Competitor` and `CompetitorDetail`.

2. **`Frontend/src/components/dashboard/momentum-chip.tsx`** — new component:

   ```
   ┌─────────────────────────┐
   │ 🚀 Rising · +45%       │   rising (green)
   │ →  Stable · +8%        │   stable (default)
   │ ⚠️  Slowing · -28%      │   slowing (amber)
   │ 📉 Declining · -62%     │   declining (red)
   │ ⋯  Insufficient data    │   insufficient-data (grey)
   └─────────────────────────┘
   ```

3. **`Frontend/src/app/(dashboard)/dashboard/competitors/[id]/page.tsx`** — render `<MomentumChip>` inside the Overview's "Activity (last 30 days)" card header, next to the "X changes" count.

4. **Competitor list page** (`Frontend/src/app/(dashboard)/dashboard/page.tsx` or wherever the competitors list lives) — add secondary sort key: momentum desc, then fall back to name.

### Verification

- With any competitor that has ≥ 14 days of data, refresh competitor detail page.
- Confirm chip renders correct bucket given change counts.
- New accounts with < 3 findings in 14d show `insufficient-data` without crashing.
- Competitor list reorders correctly.

---

## Phase 2 — Threat level (Claude synthesis)

### Goal
Assign each competitor `'critical' | 'high' | 'medium' | 'low' | 'monitor'` based on their `derivedState` + recent Changes + momentum. Render as a prominent MetricCard on the Overview tab (tone `destructive` for critical/high, `warning` for medium, `default` below). Sort dashboard competitor list by threat desc, with momentum as tie-breaker.

### Why second feature
- Single highest-value user read.
- Depends on Phase 0's enriched data to make the call credibly.
- Pairs with momentum: together they answer "should I worry about this competitor right now?"

### Research prompt changes

None. This is a synthesis call over data already collected.

### Data model changes

File: `Backend/src/shared/types/competitor.ts`

```typescript
export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'monitor';

export interface Competitor {
  // ...existing fields
  threatLevel?: ThreatLevel;
  threatReasoning?: string;     // 1-2 sentence user-facing rationale
  threatAsOf?: string;           // ISO timestamp
}
```

### Backend changes

1. **`Backend/src/shared/services/anthropic.ts`** — new function:

   ```typescript
   export async function scoreCompetitorThreat(input: {
     competitorName: string;
     userCompanyName?: string;
     userIndustry?: string;
     latestFinding: Pick<ResearchFinding, 'summary' | 'categories' | 'derivedState'>;
     recentChanges: Array<Pick<Change, 'aiAnalysis' | 'significance' | 'detectedAt'>>;
     momentum: Momentum;
   }): Promise<{ threatLevel: ThreatLevel; reasoning: string }>
   ```

   Uses Haiku (cheap, ~$0.002/call). JSON-mode prompt asks Claude to rate threat using the scoring guide:
   - `critical` — direct market overlap + rising momentum + recent strategic move
   - `high` — direct overlap OR major strategic move
   - `medium` — adjacent threat, notable activity
   - `low` — adjacent, low activity
   - `monitor` — tangential, for awareness only

2. **`Backend/src/functions/pipeline/deep-research.ts`** — after persisting the ResearchFinding (step 4), call `scoreCompetitorThreat()` and `computeMomentum()` + update the Competitor record via `updateItem()`. New fields `threatLevel`, `threatReasoning`, `threatAsOf`, `momentum`, `momentumChangePercent`, `momentumAsOf`.

3. **`Backend/src/functions/api/competitors/get.ts`** and `list.ts` — return the new threat fields.

### Frontend changes

1. **`Frontend/src/lib/types/competitor.ts`** — mirror `ThreatLevel` + new fields.

2. **`Frontend/src/components/dashboard/threat-badge.tsx`** — new component:

   ```
   ┌──────────────────────────────────┐
   │ 🔴 CRITICAL threat               │   critical (destructive)
   │    "Recently raised Series B,    │
   │     shipping aggressively..."    │
   └──────────────────────────────────┘
   ```

   Variants: critical (red), high (orange), medium (amber), low (green), monitor (grey).

3. **`Frontend/src/app/(dashboard)/dashboard/competitors/[id]/page.tsx`** — replace the "High Priority" MetricCard (which showed significance ≥ 7 count) with `<ThreatBadge>` as the first card in the Overview grid. Keep the count card as one of the others.

4. **Dashboard competitor list** — primary sort key: threat desc; secondary: momentum desc; tertiary: name.

### Verification

- After a successful research run, the Competitor record in DynamoDB shows `threatLevel` + reasoning.
- Overview page shows the right color threat badge.
- Dashboard list reorders with critical/high at the top.
- Cost: total research run should be ~$0.27-0.32 (was ~$0.25 + ~$0.02 for Haiku threat call).

---

## Phase 3 — Per-competitor tag chips

### Goal
Auto-apply 5-10 descriptive tag chips under the competitor's name in the header, derived from `derivedState` (mostly rule-based) plus a small Haiku pass for nuance (e.g. `just-raised` if fundingState is `recently-raised` AND we have Change with sourceCategory `funding` in last 30 days).

### Why third
- Depends on Phase 0's `derivedState`.
- Largely rule-based — once Phase 0 lands, this is mostly mapping enums to tags.
- Visual density: lets users scan state in under a second.

### Research prompt changes

None.

### Data model changes

File: `Backend/src/shared/types/competitor.ts`

```typescript
export interface Competitor {
  // ...existing fields
  derivedTags?: string[];        // e.g. ['growth-stage', 'just-raised', 'shipping-fast', 'ai-native', 'going-upmarket']
  derivedTagsAsOf?: string;
}
```

### Backend changes

1. **`Backend/src/shared/utils/competitor-metrics.ts`** — add `deriveTagsFromState()`:

   ```typescript
   export function deriveTagsFromState(input: {
     derivedState: DerivedState;
     recentChanges: Change[];        // to compute e.g. `just-raised` flag
     momentum: Momentum;
     threatLevel?: ThreatLevel;       // to add 'high-priority' only if relevant
   }): string[]
   ```

   Rules:
   - `stage` → `{stage}-stage` (e.g. `growth-stage`)
   - `fundingState: 'recently-raised'` AND funding-category Change in last 30d → add `just-raised`
   - `fundingState: 'runway-concerns'` → add `runway-low`
   - `hiringState` → map directly (`aggressive` → `hiring-aggressively`, `frozen` → `hiring-frozen`, `layoffs` → `layoffs`)
   - `strategicDirection` (if not 'steady' or 'unknown') → map directly (e.g. `going-upmarket`)
   - `techPositioning: 'ai-native'` → add `ai-native`
   - `pacing: 'shipping-fast'` → add `shipping-fast`
   - `momentum: 'declining'` AND `threatLevel: 'monitor'` → add `deprioritize`
   - Cap at 6 tags; drop lower-priority ones first (order: threat-relevant > stage > funding > hiring > strategy > tech > pacing).

2. **`Backend/src/functions/pipeline/deep-research.ts`** — call `deriveTagsFromState()` alongside threat + momentum updates. Write to Competitor.

3. **`get.ts` / `list.ts`** — return `derivedTags`.

### Frontend changes

1. **`Frontend/src/components/dashboard/competitor-tag-chips.tsx`** — new component:

   ```
   Competitor header:
   ┌─────────────────────────────────────────────────┐
   │ ← Deepseek                    [Research Now]    │
   │ [growth-stage] [just-raised] [shipping-fast]    │
   │ [ai-native] [going-upmarket] [+1]                │
   └─────────────────────────────────────────────────┘
   ```

   Badge variant by category — funding tags amber, velocity green, concerns red.

2. **`Frontend/src/app/(dashboard)/dashboard/competitors/[id]/page.tsx`** — render `<CompetitorTagChips>` immediately below `<PageHeader>` in the header area.

3. **Tag legend tooltip** on hover for each chip (1-line explanation).

### Verification

- 3 different competitors each show a distinct tag set that visibly matches their `derivedState`.
- Tags update after each research run (i.e. are not stale).
- Tag list doesn't exceed 6 visible chips.

---

## Phase 4 — Predicted next moves

### Goal
For each competitor with ≥ 2 historical ResearchFindings, generate top 3 predictions about what they'll do in the next 30-90 days. Render on the Overview tab as a dedicated card. Each prediction has probability, reasoning, and a time horizon.

### Why last
- Highest AI cost (~$0.02 Sonnet call per research run).
- Needs 2+ research snapshots → new competitors show empty state for one cycle.
- Highest wow factor, justifies the cost.

### Research prompt changes

None to `deepResearch()`. The prediction function runs separately with historical context as input.

### Data model changes

File: `Backend/src/shared/types/competitor.ts`

```typescript
export interface PredictedMove {
  move: string;                         // headline: "likely to launch EU product tier"
  reasoning: string;                    // 1-2 sentences citing specific findings
  probability: number;                  // 0-1
  timeHorizon: '30d' | '60d' | '90d';
  category: 'product' | 'pricing' | 'funding' | 'hiring' | 'geo' | 'strategic';
}

export interface Competitor {
  // ...existing fields
  predictedMoves?: PredictedMove[];     // max 3
  predictedMovesAsOf?: string;
}
```

### Backend changes

1. **`Backend/src/shared/services/anthropic.ts`** — new function:

   ```typescript
   export async function predictNextMoves(input: {
     competitorName: string;
     latestFinding: Pick<ResearchFinding, 'summary' | 'categories' | 'derivedState'>;
     priorFindings: Array<Pick<ResearchFinding, 'summary' | 'categories' | 'derivedState' | 'generatedAt'>>;  // up to 3 prior
     recentChanges: Array<Pick<Change, 'aiAnalysis' | 'detectedAt' | 'sourceCategory'>>;
   }): Promise<PredictedMove[]>
   ```

   Sonnet 4.5 call with ~6000-token input (multiple findings), ~2000-token output. Structured JSON output. Max 3 predictions. Honors the retry/backoff wrapper we already built.

2. **`Backend/src/functions/pipeline/deep-research.ts`**:

   - Load up to 3 prior findings (we already load 1 for delta detection; extend to 3).
   - Skip predictions if fewer than 1 prior finding exists (truly first run).
   - Call `predictNextMoves()` after threat + tags + momentum.
   - Write result to Competitor.

### Frontend changes

1. **`Frontend/src/lib/types/competitor.ts`** — mirror `PredictedMove`.

2. **`Frontend/src/components/dashboard/predicted-moves-card.tsx`** — new component:

   ```
   ┌──────────────────────────────────────────────────┐
   │ 🔮 Predicted next moves                           │
   │ ────────────────────────────────────────────────  │
   │ 1. Likely to launch EU pricing tier   [30d · 75%] │
   │    "Hiring pushes in DE/FR + GDPR mentions..."    │
   │                                                    │
   │ 2. Likely to raise Series C             [90d · 60%] │
   │    "Strong hiring + recent PR campaign..."          │
   │                                                    │
   │ 3. Likely to sunset free tier          [60d · 45%]  │
   │    "Pricing-page messaging shift..."                │
   └──────────────────────────────────────────────────┘
   ```

   Collapsed by default with only #1 visible + "2 more" toggle.

3. **`Frontend/src/app/(dashboard)/dashboard/competitors/[id]/page.tsx`** — add the card to Overview, below the research summary card.

### Verification

- Competitor with 2+ research runs shows 1-3 predicted moves.
- Predictions reference specific findings in their reasoning (not generic).
- Probability values are sensible (no three 95% predictions).
- Cost: total research run now ~$0.30-0.35.
- Empty state for first-run competitors: card says "Run research at least twice to see predictions."

---

## Phase 5 — Cross-competitor dashboard polish

### Goal
Use all the new per-competitor signals (threat, momentum, tags) to make the main `/dashboard` page answer "who do I worry about today?" at a glance — not just the detail page.

### Prerequisites
Phases 1-4 landed.

### Frontend changes

1. **Ranked competitor strip** at the top of `/dashboard`:

   ```
   ┌──────────────────────────────────────────────────┐
   │ Your competitors, ranked by threat                │
   │  🔴 Critical (1)        ⚠️ High (2)                │
   │  ➡️ Medium (3)          ✅ Low (0)                 │
   │                                                    │
   │ [Deepseek   🔴 🚀]  [ChatGPT  ⚠️ →]  [Claude ⚠️ →] │
   │ [Perplexity ➡️ ⋯ ]  ...                            │
   └──────────────────────────────────────────────────┘
   ```

2. **Filter pills** on the competitor list: "Critical only" / "Rising momentum" / "Just raised" / "Hiring fast" — each pre-wired to the new tag / threat filters.

3. **Empty state improvements**: if all competitors are `insufficient-data`, don't show ranked strip; surface an onboarding hint instead.

### Backend changes

Potentially none if all data is already returned by `list.ts`. Otherwise add filter query params.

### Verification

- With 4+ competitors at different threat levels, the strip renders correctly.
- Filter pills narrow the list as expected.
- Page loads within 500ms (should — data is already cached from existing queries).

---

## Deployment sequence per phase

Each phase follows the same template:

1. Make the code changes.
2. `cd Backend && npx tsc --noEmit` and `cd Frontend && npx tsc --noEmit && npm run lint`.
3. `cd Backend && npx cdk deploy RivalScan-dev-Pipeline RivalScan-dev-Api` (or `RivalScan-dev-Pipeline` alone if no API signature changes).
4. Commit + push → Amplify auto-builds frontend.
5. E2E verify per phase's Verification section.
6. Check CloudWatch Logs for the DeepResearch Lambda and confirm no new errors.

---

## Cost summary (Priority 3 complete)

Per research run once all phases are live:

| Cost center | Before | After |
|---|---|---|
| `deepResearch` (Sonnet + web_search) | ~$0.20 | ~$0.22 (enriched prompt adds ~300 tokens output) |
| `detectResearchDeltas` (Sonnet) | ~$0.05 | ~$0.05 |
| `scoreCompetitorThreat` (Haiku) | — | ~$0.002 |
| `predictNextMoves` (Sonnet) | — | ~$0.02 |
| Rule-based (momentum, tags) | — | $0 |
| **Total per run** | **~$0.25** | **~$0.30** |

At 25 competitors run once each on onboarding: ~$7.50 worst case. At manual "Research Now" per click: ~$0.30. Still well within the $49-199/mo margin envelope.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Claude produces poor `derivedState` for small companies with thin web presence | Prompt explicitly tells Claude to use `unknown` liberally. UI hides tags derived from `unknown` state. |
| Threat level feels arbitrary ("why is X critical?") | Always render `threatReasoning` alongside the badge, and include which signals drove it. |
| Predictions feel generic ("likely to raise funding") | Prompt requires each prediction to cite specific findings. Code validates that `reasoning` is ≥ 20 chars and references at least one source. |
| AI cost spikes on onboarding of a large customer | Map concurrency already set to 1. Large onboards simply take longer, don't fan out. |
| Historical momentum data looks wrong for first 2-3 weeks | `insufficient-data` state hides the chip + surfaces tooltip "Need more runs for momentum" |

---

## What this roadmap deliberately skips

Referenced in the ideation doc but not in the priority 3:

- Pricing change probability — strong candidate for Phase 6 follow-up.
- Hiring velocity index (as a separate metric) — partly covered via `hiringState` tag.
- All Tier B items (funding signals, market expansion, pivot detection, sentiment, M&A).
- Weekly digest integration — worth a separate doc once Phase 3 + 4 have baked.
- Tier-gating decisions — still open; deploy un-gated to get signal first.

These stay in the backlog and don't need to block Priority 3 shipping.
