# Kironyx — Pricing Structure & Component Value Report

> **Audience:** Internal product / strategy.
> **Scope:** How the tier structure works and what value each product component delivers to the user.
> **Deliberately excluded:** All pricing figures, internal AI spend, and the monthly spend ceiling. This
> report covers *structure and value*, not money.
> **Source of truth:** `Backend/src/shared/types/index.ts` (`PLAN_LIMITS`),
> `Backend/src/shared/types/capabilities.ts` (`CAPABILITIES`), and
> `Backend/src/shared/utils/capability.ts` (the gating helpers). The backend is the enforcement
> authority; `Frontend/src/lib/utils/capabilities.ts` mirrors the matrix for UI gating only.

---

## 1. Overview

Kironyx sells a three-tier ladder — **Scout → Strategist → Command** — where each tier is a strict
superset of the one below it: more capacity, plus a few exclusive capabilities at the top.

Two independent mechanisms define the structure, and they are enforced separately in code:

1. **`PLAN_LIMITS`** — hard numeric caps (how *many* competitors, how *much* history, how *often* research
   runs). Enforced at write time; exceeding a cap returns a `PLAN_LIMIT` error.
2. **`CAPABILITIES`** — the qualitative matrix of *which features a tier unlocks* (exports, integrations,
   API, etc.) and a few numeric capacities (seats, saved views, API keys, visible recommendations).
   Enforced through `hasCapability()` / `capabilitiesFor()`; a locked feature returns a `403 PLAN_REQUIRED`.

Most "is this feature on?" decisions go through the capability matrix; only the oldest count-based caps
still read `PLAN_LIMITS` directly. New gating is expected to be added to the capability matrix.

---

## 2. Tier Structure Matrix

### 2.1 Hard numeric limits (`PLAN_LIMITS`)

| Limit | Scout | Strategist | Command | Meaning |
|---|---|---|---|---|
| Max competitors tracked | 3 | 10 | 25 | Active competitor rows; the self-brand row is excluded from this count |
| History window (days) | 30 | 90 | 365 | How far back changes/findings remain queryable; also clamps analytics windows |
| Research runs / day | 10 | 30 | 100 | Daily quota of on-demand + scheduled research passes |
| Default recurring cadence (days) | 7 | 7 | 14 | How often the recurring scheduler re-researches a competitor absent a per-competitor override |

*(A monthly spend ceiling field also exists per tier; it is a money mechanism and is intentionally omitted
from this report.)*

### 2.2 Capability & capacity matrix (`CAPABILITIES`)

| Capability | Scout | Strategist | Command |
|---|---|---|---|
| Predicted moves | ✓ | ✓ | ✓ |
| Brand Pulse (self-brand monitoring) | ✓ | ✓ | ✓ |
| Visible recommendations | 3 | 10 | unlimited |
| PDF exports | — | ✓ | ✓ |
| CSV exports | — | ✓ | ✓ |
| Slack integration | — | ✓ | ✓ |
| Webhook integration | — | ✓ | ✓ |
| Comparator matrix | — | ✓ | ✓ |
| Public API access (`/v1`) | — | ✓ | ✓ |
| API keys (max) | 0 | 5 | 25 |
| Saved views (max) | 0 | 5 | 25 |
| Seats (max) | 1 | 5 | 25 |
| Custom recommendation focus areas | — | — | ✓ |
| Scheduled reports | — | — | ✓ |

Legend: ✓ = unlocked, — = locked, `unlimited` is stored as `-1`, `0` = feature locked at that tier.

---

## 3. Gating Mechanics — how the structure is enforced

Understanding *where* each gate lives matters for product decisions, because it determines how cleanly a
limit can be moved between tiers.

- **Boolean feature gates.** A handler calls `hasCapability(user, 'flag')` and throws `403 PLAN_REQUIRED`
  when false. This guards CSV/PDF exports, the comparator matrix, public API access, and Brand Pulse setup.
  Moving one of these between tiers is a one-line matrix edit.
- **Numeric capacity gates.** Handlers read `capabilitiesFor(user).<field>.max` and compare it to the
  current count (e.g. `saved-views/create.ts`, `api-keys/create.ts`). `0` means the feature is locked
  entirely at that tier; `-1` means unlimited.
- **Hard write-time caps.** The oldest caps (max competitors) read `PLAN_LIMITS` directly in
  `competitors/create.ts`. The self-brand row is excluded so monitoring your own brand never consumes a
  competitor slot.
- **Research eligibility is a separate layer.** Before any research runs, `enforceResearchEligibility`
  applies the daily quota, account status, a sanctions check, and an input classifier. This is a
  quota/safety gate that sits *on top of* tier limits — it is not itself a tier feature, and it is the
  mechanism behind the (omitted) spend-ceiling behavior.
- **Backend is authoritative; frontend mirrors.** The frontend capability mirror only decides what to show,
  disable, or prompt-to-upgrade. Every limit is independently re-checked server-side, so a tampered client
  cannot unlock a feature.

---

## 4. Component Value Inventory

Each component below lists **what it is**, the **value to the user**, and **which tiers unlock it**.

### 4.1 Core intelligence — *all tiers*

These are the reason the product exists; they are available from Scout up. The identical
pipeline also runs against the workspace's own brand (`targetKind: 'self'`) — see §4.2; the
engine is bidirectional by design.

- **AI Deep Research pipeline.** For every competitor, Claude runs a managed web-search loop and returns
  structured findings across five categories — **news, product, funding, hiring, social** — each with
  source citations, a sentiment and time-sensitivity tag, and a synthesized `derivedState` (stage, funding
  posture, hiring momentum, strategic direction, technical positioning).
  *Value:* turns the open web into a categorized, sourced competitor brief without manual searching.
- **Delta detection.** Each run compares the new findings against the prior baseline and surfaces only
  what is genuinely *new*, scored for significance with strategic-implication analysis.
  *Value:* the user reads changes, not a re-dump of facts they already know.
- **Per-competitor enrichment** (written back to each competitor after every run):
  - **Momentum** — 30-day change-velocity trend (rising / stable / slowing / declining) with a percent
    delta. *Value:* who is accelerating vs. going quiet, at a glance.
  - **Threat level + reasoning** — a critical/high/medium/low/monitor rating *personalized to the user's
    own company context*, with a one-to-two sentence rationale. *Value:* prioritization with a stated "why."
  - **Derived tags** — up to six priority-ordered signal chips (e.g. `just-raised`, `hiring-aggressively`,
    `ai-native`). *Value:* the most actionable signal is visible without opening the record.
  - **Predicted moves** — evidence-cited 30/60/90-day forecasts per competitor, each with a probability.
    *Value:* forward-looking planning, not just a rear-view mirror. (Capability flag on every tier.)
- **Recommendations.** A weekly synthesis of all changes/predictions/momentum into a short, calibrated
  action list — each item framed as *"what we should do,"* tagged with category, effort, time horizon,
  confidence, and the triggering change. *Value:* converts intelligence into a team to-do list.
  **Tier interaction:** the *number visible* is capped — 3 (Scout) / 10 (Strategist) / unlimited (Command).
- **Weekly digest email.** Monday email with the top recommended actions, the top changes of the week, and
  a strategic prose briefing. *Value:* the passive-consumption surface for users who never open the app.

### 4.2 The comparative core — *all tiers*

Brand Pulse and its comparative views are intentionally available on every tier (see §5).

- **Brand Pulse (self-brand monitoring).** The user's *own* brand, run through the identical
  deep-research pipeline and benchmarked side by side with competitors — the second half of the
  product's bidirectional core, not an add-on. Surfaces a coverage feed, a 12-week
  sentiment time-series, and the Brand Health Score. *Value:* combines competitive *and* self-monitoring in
  one product, reaching the PR/comms persona, not just product/strategy.
- **Brand Health Score (0–100).** A composite of three equally weighted components — sentiment, share of
  voice, and momentum — with a confidence badge keyed to mention volume. *Value:* one trackable KPI for
  brand perception, with the breakdown one click away.
- **Share of Voice.** Per-period (7/30/90-day) ranking of who "owns" the narrative, overall and per
  category, with the user's own brand ranked honestly alongside competitors. *Value:* shows where the brand
  leads or trails the conversation.
- **Comparative Weekly Briefing.** An opt-in PR-flavored email contrasting the user's brand momentum against
  competitors', plus 2–3 suggested narrative angles. *Value:* turns the analytics into pitchable hooks.

### 4.3 Collaboration & access — *Strategist and up*

This band is the first paywall: features that signal a team has moved from "one person watching" to
"operationalizing" competitive intelligence.

- **PDF exports** — board-ready weekly briefing document. *Value:* shareable up the chain.
- **CSV exports** — changes / competitors / recommendations as data. *Value:* feeds spreadsheets and BI.
- **Slack integration** — high-significance changes pushed to a channel in real time. *Value:* alerts where
  the team already works, without email latency.
- **Webhook integration** — HMAC-signed POSTs on saved-view matches. *Value:* custom routing and automation.
- **Comparator matrix** — all competitors as rows, with the user's own brand pinned on top as the
  reference line, and threat/momentum/stage/tags columns. *Value:* at-a-glance "where do we stand"
  portfolio health.
- **Saved views + subscriptions** — reusable named filter sets (e.g. "AI competitors' product launches"),
  individually subscribable by teammates. *Value:* personalized, repeatable focus. Capacity: 5 (Strategist)
  / 25 (Command); locked on Scout.
- **Public API (`/v1`) + keys** — X-API-Key read access to competitors, changes, and recommendations.
  *Value:* data-warehouse sync, custom dashboards, bots. Capacity: 5 keys (Strategist) / 25 (Command).
- **Multi-seat workspaces & roles** — shared workspace data with an `owner > admin > member` hierarchy.
  *Value:* real team collaboration with role-appropriate permissions. Seats: 1 (Scout, effectively solo) /
  5 (Strategist) / 25 (Command).

### 4.4 Power & scale — *Command only*

The top tier adds power-user/enterprise differentiation on top of the largest capacity numbers.

- **Custom recommendation focus areas** — the user names 1–3 themes (e.g. "channel partnerships") and the
  weekly recommendation generator biases toward them. *Value:* tailors the playbook to current priorities.
- **Scheduled reports** — automated monthly briefing delivery. *Value:* hands-off executive reporting.
- **Unlimited visible recommendations** + the largest caps (25 competitors, 365-day history, 25
  seats/views/keys). *Value:* removes ceilings for the highest-volume accounts.

### 4.5 Cross-cutting — *not tier-gated*

Available regardless of tier (subject to the underlying feature's own rules):

- **Battlecards** — per-competitor PDF combining research, threat assessment, and 3–5 AI win-against
  tactics (each rated difficulty/impact), shareable via a 30-day public token link. *Value:* sales
  enablement on demand.
- **In-app notifications** — polling feed for critical changes, view matches, recommendations, and team
  events. *Value:* an in-product alternative to email.
- **Onboarding competitor suggestions** — Claude proposes 5–8 likely competitors from the user's company
  profile. *Value:* solves the blank-page start.
- **GDPR data export & account controls** — full personal-data export for compliance. *Value:* trust and
  regulatory coverage.
- **Public status page** — live service-health surface driven by CloudWatch alarms. *Value:* transparency.
- **Misuse / sanctions defense** — sanctions screening + an input classifier reject improper research
  targets before any run. *Value:* keeps the product safe and compliant.

---

## 5. Strategic Gating Rationale *(internal)*

Why the lines are drawn where they are:

- **Brand Pulse ships on every tier because it is half the product's core promise.** Kironyx is
  positioned as bidirectional — competitive intelligence benchmarked against the customer's own brand —
  so a tier without the self-brand row would be selling one-directional competitor tracking, which is
  no longer what the product is. It also opens the product to the PR/comms persona rather than only
  product/strategy buyers, and the marginal compute to run it is small enough to absorb everywhere (per
  the `capabilities.ts` doc-comment). **Predicted moves remain universal** for the same top-of-funnel
  reason: putting either behind a paywall would blunt the reach they exist to create.
- **Exports, integrations, and the API are the Strategist paywall.** These are operational-maturity signals:
  a solo user evaluating the product rarely needs Slack alerts, CSV pipelines, or programmatic access, but a
  team operationalizing competitive intelligence does. They are the most natural "we've outgrown Scout"
  trigger, which is why the first paywall sits here rather than on core intelligence.
- **Custom focus areas and scheduled reports are Command-exclusive.** These are power-user/enterprise
  differentiators — they assume an established workflow worth tailoring and automating — so they anchor the
  top tier alongside the largest capacity numbers.
- **Recommendation *visibility* is metered rather than gated.** Every tier *gets* recommendations; lower
  tiers simply see fewer (3 / 10 / unlimited). This preserves the feature as a universal hook while still
  giving an upgrade reason.
- **Seats capacity is partly forward-looking.** The seats matrix predates full multi-seat enforcement (per
  the code comment), so treat the seat numbers as the intended structure rather than a fully hardened limit.

---

## 6. Summary

The structure is deliberately simple: a strict superset ladder with two clean upgrade triggers — *capacity*
(more competitors, history, seats, views, keys) and *capability* (Strategist unlocks team/operational
features; Command unlocks power-user automation). The core intelligence engine and the comparative core
(Brand Pulse and its analytics) are universal, ensuring every paying user experiences the product's central
value — the side-by-side comparison — while still having a clear reason to climb the ladder.
