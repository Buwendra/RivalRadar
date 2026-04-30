# Product Gaps & Growth Roadmap (Multi-Phase)

> Companion to [ROADMAP.md](ROADMAP.md), [COMPLIANCE_ROADMAP.md](COMPLIANCE_ROADMAP.md), and [PREDICTIONS_AND_TAGS.md](PREDICTIONS_AND_TAGS.md). This document covers structural product/operational gaps that won't be visible from feature-by-feature delivery alone.

## Context

The compliance work shipped in commit `e69957c` closed the legal/regulatory gaps. Stepping back from feature-by-feature delivery and looking at the system as a product, several structural gaps remain that will limit retention, monetization, and operational health as the userbase grows:

- **The product loop breaks after week 1.** Research only runs on onboarding or manual click — there is no recurring cadence. The Monday digest depends on `Change` records that may never arrive, so most users will see a stale dashboard and an empty digest by week 2.
- **Output is informational, not actionable.** Predicted moves describe what *the competitor* will do; nothing tells the user what *they* should do in response. SMB founders want answers, not dashboards.
- **Single delivery channel.** Email-only digest decays badly when SMBs live in Slack.
- **Single-seat / single-tenant.** Locks out agencies and team usage; caps the upgrade path on Strategist/Command tiers.
- **Tier differentiation is purely quantitative.** Strategist vs Command differs only in `maxCompetitors` + `historyDays`. There's no qualitative unlock to drive upgrades.
- **Margin observability is missing.** Anthropic costs are captured per-call (token counts in the API response) but never logged or aggregated per user. Once recurring research goes live, margin will compress fast on Command tier without visibility.
- **No multi-channel notifier abstraction, no mute/snooze, no exports beyond GDPR JSON, no team audit log, no source-quality weighting.**

This plan addresses all of those, plus the deferred items from `COMPLIANCE_ROADMAP.md` (Phases 4.2–4.8, 5+, 6+7), in a phased program with explicit architectural principles. Each phase is independently shippable; later phases depend on earlier ones only where called out. Effort estimates are session-sized (one focused build session = ~3–6 hours of execution).

**Goal**: A defensible product with a closed feedback loop (research → action → outcome → re-evaluation), multi-channel delivery, real tier differentiation, team-aware data model, and the operational + security + certification posture to sell into companies that ask hard questions.

## Architecture Principles (cross-cutting)

Every phase respects these rules. They keep the system coherent as scope grows.

1. **Event-driven over polling.** New scheduled or async work uses EventBridge → Step Functions or SQS → Lambda. No new cron-style polling loops in handlers.
2. **Fail-closed on user-impacting paths.** Misuse classifier, sanctions, rate limits, cost ceilings — when uncertain, deny. (Already the rule for the eligibility helper; extend to cost-cap kill-switch.)
3. **Observable by default.** Every new feature emits at least one structured CloudWatch log line per material event (`logger.info('event_name', { …context })`). Same shape as the existing `ai_call_completed` line. No silent code paths.
4. **Tier-gated capabilities, not just count limits.** Replace the implicit "Scout has 3 competitors" mental model with an explicit `Capability` matrix (`predicted_moves: true`, `slack_integration: false`, `pdf_exports: true`). Drives both the upgrade narrative and the gating helpers.
5. **Idempotency on retry-prone paths.** Anything driven by EventBridge or chained Step Function tasks must produce the same outcome on duplicate invocation (use `aiCallId` / `changeId` / `recommendationId` ULIDs as natural dedupe keys).
6. **Async where latency hurts.** User-facing requests (research, exports, digest generation, recommendation generation) return 202 + a job ID, not block on multi-second LLM calls. Existing pattern: ResearchPipeline state machine.
7. **Single source of truth per concept.** Don't fork user data between Cognito and Dynamo, don't fork tier limits between Frontend and Backend constants — derive one from the other or share a generated module. (Already-known drift: `Frontend/src/lib/utils/plan-limits.ts` is missing `researchPerDay` from the recent compliance work — fix in Phase 1.)
8. **Cost guardrails as code.** Per-user daily token ceilings, per-organization spend alarms, kill-switch when monthly Anthropic budget hits 80%. Don't rely on AWS budget emails to catch a runaway loop.
9. **Backwards-compatible migrations.** All schema changes (new entities, new fields) treat absence as a safe default — existing rows keep working without backfill jobs unless absolutely required. When a backfill *is* required, it ships as a one-shot Lambda invoked manually with explicit confirmation.
10. **Reversibility.** Each phase's work can be feature-flagged or env-toggled off without breaking earlier phases. No flag-day cutovers.

## Phase Summary Table

| # | Phase | Theme | Effort | Depends on | Reversible? |
|---|---|---|---|---|---|
| 1 | Pipeline continuity & cost observability | Loop closure + margin protection | M | — | Yes (cron toggle) |
| 2 | Recommended actions layer | Closes value loop | M | 1 | Yes (feature flag) |
| 3 | Multi-channel delivery | Slack / webhook / critical alerts | M | — (parallel-safe) | Yes (channel toggle) |
| 4 | Workspaces, teams & seats | Multi-tenant data model | L | — (but high blast radius) | Hard — schema migration |
| 5 | Onboarding & top-of-funnel | AI competitor discovery, mobile, tour | M | — | Yes |
| 6 | Tier differentiation & exports | Monetization unlock | M | 1, 2, 3 | Yes |
| 7 | UX intelligence | Mute/snooze, notes, filters, search | M | 4 (workspace-aware) | Yes |
| 8 | Operational maturity | Prompt A/B, churn, retention loops, status page | M | 1 | Yes |
| 9 | Security & compliance hardening | WAF, throttling, CloudTrail, npm audit, runbooks | M | — | Yes |
| 10 | Trust & certifications | SOC 2 Type 1 → Type 2, ISO 27001 | XL | 9 | N/A |

Effort: S = single session, M = 1–2 sessions, L = 3+ sessions, XL = external program (months, lawyer/auditor-driven).

---

## Phase 1 — Pipeline Continuity & Cost Observability

**Goal**: Close the product loop. After week 1, every active competitor automatically gets re-researched on a schedule, and we can see per-user cost so margin doesn't silently collapse.

**Why now**: This is the only urgent phase. Without recurring research, the Monday digest is empty for week 2 onward and momentum/threat/predictions all freeze. Cost observability is paired because turning on the cron will multiply Anthropic spend and we need a dashboard *before* the bill arrives.

### Scope

1. **Recurring research scheduler.**
   - New EventBridge rule fires weekly (Sunday 6am UTC, ~26 hours before digest aggregation).
   - New Lambda `pipeline/enqueue-recurring-research.ts` queries GSI2 (`PK=ACTIVE`) for all competitors, batches them by user (to respect tier daily caps), and starts the existing ResearchPipeline state machine with each batch.
   - Per-tier cadence: Scout = weekly, Strategist = weekly + on-demand, Command = bi-weekly + on-demand. Cadence overridable via per-competitor `researchCadenceDays` field (default null = tier default).
   - Skip research if a finding exists newer than `cadenceDays - 1` (idempotency on enqueue).
   - Honor `enforceResearchEligibility` (status, sanctions, rate limit, classifier) — recurring runs count toward daily quota the same as manual ones.

2. **Per-call token logging.**
   - `callAnthropic` already returns the response with `usage.input_tokens` / `output_tokens` (verified — captured but not logged today).
   - Enrich the existing `ai_call_completed` log line with `inputTokens`, `outputTokens`, `costUsd` (computed from a model→price map in `shared/utils/anthropic-pricing.ts`).
   - Plumb `userId` into `callAnthropic` via an optional `context` parameter; default `null` for non-user-attributable calls (system tasks).

3. **Daily cost aggregator.**
   - New Lambda `scheduled/aggregate-ai-costs.ts` runs nightly (3am UTC). Reads the prior day's CloudWatch Logs Insights query for `ai_call_completed` events, groups by `userId`, writes a `CostDay` entity to DynamoDB (`PK=USER#<id>`, `SK=COST#<YYYY-MM-DD>`).
   - Roll-up fields: `totalCalls`, `totalInputTokens`, `totalOutputTokens`, `totalCostUsd`, `byOpName: { deepResearch: {...}, predictNextMoves: {...} }`.
   - Retention: 90 days hot, then auto-delete via DynamoDB TTL field.

4. **Cost guardrail kill-switch.**
   - New field on User: `monthlyTokenBudget` (default null = unlimited / use tier default), `monthToDateCostUsd` (updated nightly by aggregator), `monthToDateCostMonth` (YYYY-MM, used to detect month rollover).
   - `enforceResearchEligibility` adds a 5th check: if `monthToDateCostUsd > tier.monthlyCostCap` → reject with `code: 'COST_CAP_EXCEEDED'`. Tier caps: Scout $5/mo, Strategist $20/mo, Command $80/mo.
   - Per-organization (across all users) Anthropic budget alarm via CloudWatch — 80% triggers SNS topic that emails owner.

5. **Outage alerting.**
   - CloudWatch alarms on: research Lambda error rate > 10% over 15min, weekly digest Lambda errors at all (single failure → page), SES bounce rate > 5%, Anthropic 5xx rate > 20% over 5min.
   - Alarms route to a single SNS topic `RivalScan-${stage}-Alerts` → owner email for now (later, Slack/PagerDuty in Phase 3 + 8).

### Architecture decisions

- **Schedule on Sunday, digest on Monday** — gives the research Step Functions ~26 hours to complete (Map state with `maxConcurrency: 1`; 50 active users × 5 competitors avg × ~2 min/run = ~8 hours worst case). Comfortable buffer.
- **Cost aggregation via Logs Insights, not real-time** — avoids hot-path DynamoDB writes on every Anthropic call. Eventual consistency (24h lag on cost cap) is acceptable; combine with the existing real-time soft cap (`researchPerDay` quota already in place).
- **Cost data on DynamoDB, not separate analytics store** — keeps it queryable from the same handlers as user data; volume is tiny (one row per user per day).
- **No API for cron management yet** — cron config lives in CDK; per-competitor cadence override is a future tier-6 feature.

### Data model deltas

- **New entity**: `CostDay` — `PK=USER#<id>`, `SK=COST#<YYYY-MM-DD>`, fields above. No GSI needed (always queried by user).
- **User**: add `monthlyTokenBudget` (optional), `monthToDateCostUsd` (denormalized cache, updated nightly), `monthToDateCostMonth`.
- **Competitor**: add `researchCadenceDays` (optional override), `lastRecurringResearchAt`.

### Capability/tier impact

- `PLAN_LIMITS` extended: `monthlyCostCap`, `researchCadenceDaysDefault`. Sync to frontend `plan-limits.ts` (currently missing `researchPerDay` already — fix that drift in this phase).

### Success metrics

- **% of active users with ≥1 fresh `ResearchFinding` in last 14 days**: target >90% week-over-week.
- **Mean cost per active user per month**: tracked + alarmed at $X (set after first 30 days of data).
- **MTTR on research-pipeline incidents**: alarm-to-page < 5 min, page-to-acknowledge < 30 min (one-person team — best effort).

### Critical files

- [Backend/lib/stacks/pipeline.stack.ts](Backend/lib/stacks/pipeline.stack.ts) — add Sunday EventBridge rule + new Lambda
- `Backend/src/functions/pipeline/enqueue-recurring-research.ts` — NEW
- [Backend/src/shared/services/anthropic.ts](Backend/src/shared/services/anthropic.ts) — extend `callAnthropic` log + accept `context.userId`
- `Backend/src/shared/utils/anthropic-pricing.ts` — NEW
- `Backend/src/functions/scheduled/aggregate-ai-costs.ts` — NEW
- [Backend/src/shared/utils/research-eligibility.ts](Backend/src/shared/utils/research-eligibility.ts) — add cost-cap check
- [Backend/src/shared/types/user.ts](Backend/src/shared/types/user.ts) — new fields
- [Backend/src/shared/types/competitor.ts](Backend/src/shared/types/competitor.ts) — `researchCadenceDays`, `lastRecurringResearchAt`
- [Backend/src/shared/types/index.ts](Backend/src/shared/types/index.ts) — extend `PLAN_LIMITS`
- [Frontend/src/lib/utils/plan-limits.ts](Frontend/src/lib/utils/plan-limits.ts) — sync with backend (also fixes existing `researchPerDay` drift)
- [Backend/lib/stacks/monitoring.stack.ts](Backend/lib/stacks/monitoring.stack.ts) — alarms + SNS topic

### Risk

- Recurring research at scale could trip Anthropic org-level rate limits (30k input tokens/min). Mitigations: Map state already has `maxConcurrency: 1`, schedule runs on Sunday (low overlap with manual runs), `callAnthropic` retry-with-backoff already in place. Add a per-minute throttle if observed.

---

## Phase 2 — Recommended Actions Layer

**Goal**: Close the value loop. For every meaningful change, the user sees "here are 2–3 things to consider doing this week" — generated by Claude with the user's company context, not just the competitor's.

**Why now**: This is what turns the product from "monitoring tool" into "decision support". Predicted moves + threat level + momentum tell the user *what's happening*; recommendations tell them *what to do*. Bigger NPS lever than any other phase.

### Scope

1. **`Recommendation` entity.** New top-level concept stored at `PK=USER#<id>`, `SK=REC#<timestamp>`. Fields: `id` (ULID), `competitorId`, `triggeringChangeIds[]`, `category` (positioning/pricing/messaging/product/sales/talent), `title`, `body` (markdown), `effortLevel` (low/medium/high), `timeHorizon` (this-week/this-month/this-quarter), `confidence` (0–1), `status` (open/dismissed/acted-on), `createdAt`, `dismissedAt`.

2. **Generation pipeline.** Run alongside the weekly digest aggregation (already a scheduled job — Phase 1 makes it data-rich). New Sonnet helper `generateRecommendations(userContext, weeklyChanges, competitorSnapshots, momentum, predictedMoves)` returns 3–7 recommendations per user per week.

3. **Dashboard surface.** New `RecommendationsCard` on the main dashboard, sorted by `confidence × significance × timeHorizon-weight`. Each card has Dismiss / Mark as Acted / "Why this?" expansion (shows triggering changes + reasoning).

4. **Email surface.** Top 3 recommendations embedded in the weekly digest email above the change list.

5. **Outcome tracking.** When user marks acted-on → log `recommendation_acted_on` event with `recId`, `userId`, `category`. Used in Phase 8 for prompt-quality measurement.

### Architecture decisions

- **One generation pass per user per week**, not per-change. Keeps cost predictable (~$0.05/user/week with Sonnet) and gives the LLM enough context to dedupe "5 small things → 1 strategic recommendation".
- **Stored as denormalized records, not regenerated on read.** Recommendations are immutable once generated; user actions update `status` only. Lets us measure realization rate over time.
- **Tier-gated capability** — Scout sees top 3, Strategist sees full list, Command sees full list + custom action templates (deferred to Phase 6).

### Data model deltas

- **New entity**: `Recommendation` (above).
- **GSI1 already covers** combined-feed queries (`USER#<id>` + `SK begins_with`); add `REC#` to the prefix filters in dashboard handlers.

### Capability/tier impact

- New capability flag: `recommendations.maxVisible` (Scout=3, Strategist=10, Command=unlimited).
- Capability matrix introduced in Phase 6, but seed the keys here.

### Success metrics

- **% of recommendations marked acted-on within 30 days**: target >15% (industry rule of thumb for actionable insights).
- **Weekly digest open-rate uplift** post-launch.
- **NPS improvement** at next quarterly survey.

### Critical files

- `Backend/src/shared/types/recommendation.ts` — NEW
- [Backend/src/shared/services/anthropic.ts](Backend/src/shared/services/anthropic.ts) — `generateRecommendations()` helper (uses prior-context pattern from `predictNextMoves`)
- `Backend/src/functions/scheduled/generate-recommendations.ts` — NEW (chained after `generate-summary` in weekly digest state machine)
- `Backend/src/functions/api/recommendations/list.ts` — NEW
- `Backend/src/functions/api/recommendations/update-status.ts` — NEW
- [Backend/lib/stacks/api.stack.ts](Backend/lib/stacks/api.stack.ts) — routes `GET /recommendations`, `PATCH /recommendations/{id}`
- [Backend/lib/stacks/pipeline.stack.ts](Backend/lib/stacks/pipeline.stack.ts) — extend weekly state machine with new task
- `Frontend/src/components/dashboard/recommendations-card.tsx` — NEW
- `Frontend/src/lib/api/recommendations.ts` — NEW
- [Backend/src/functions/scheduled/render-send-email.ts](Backend/src/functions/scheduled/render-send-email.ts) — embed top 3

### Risk

- LLM hallucination risk is high here — recommending the wrong action could cost the user real money. Mitigation: AI disclaimer prominent on every card (already standardized in compliance Phase 7), conservative `confidence` thresholding, "Why this?" expansion always visible.

---

## Phase 3 — Multi-Channel Delivery (Slack, Webhook, Real-time Critical Alerts)

**Goal**: Deliver alerts where users actually live (Slack), in the timing they actually need (real-time for high-significance changes), and via the integration shape larger customers expect (generic webhook).

**Why now**: Email-only is the single biggest retention risk after week 1. Slack delivery alone typically lifts active-use rates 2–3x in B2B SaaS at this stage.

### Scope

1. **Notifier abstraction.** New `shared/services/notifier.ts` facade with `notify(userId, channels[], payload)`. Backed by adapters: `email-adapter.ts` (existing SES), `slack-adapter.ts` (Slack incoming webhook), `webhook-adapter.ts` (generic POST). Replace the two direct `sendEmail()` call sites (`send-alert.ts`, `render-send-email.ts`) with `notify()`. Today there is **no notifier abstraction** — both call SES directly; introducing this facade is the core architectural work of the phase.

2. **Slack integration.**
   - OAuth flow: `Frontend/src/app/(dashboard)/settings/integrations/slack/connect/page.tsx` initiates → backend `api/integrations/slack/oauth-callback.ts` exchanges code → store encrypted webhook URL on User (or Workspace once Phase 4 lands) record.
   - Workspace-level (Phase 4) eventually; user-level (Phase 3) for now.
   - Slack adapter posts Block Kit messages — header, change summary, threat level chip, citation link, "View on RivalScan" button.

3. **Generic webhook.**
   - User pastes a URL in settings → we sign payloads with HMAC (per-user secret) → POST as `application/json`.
   - Same envelope for every event type: `{ event: 'change.created', data: {...}, signature, timestamp }`.

4. **Real-time critical alerts.**
   - When `deep-research.ts` detects a delta with `significance >= 8`, fire `notify()` immediately (don't wait for weekly digest).
   - Per-user mute window setting: "no alerts between 8pm–8am local time" (deferred per-user TZ, Phase 7).

5. **Notification preferences UI.**
   - Settings page: per-channel toggles, per-event-type opt-in (changes, recommendations, weekly digest, predicted-move realization).
   - Backwards-compat: existing users default to "email + critical alerts only".

### Architecture decisions

- **Adapter pattern, not feature flag** — we want to add SMS / Teams / Discord later without touching call sites.
- **Encrypted webhook URLs at rest** — KMS-encrypted DynamoDB attribute (`aws:kms` SSE), not plaintext.
- **Real-time critical alerts run inline in `deep-research.ts`**, not in a separate Step Function task — saves 1 invocation per alert, latency-critical.
- **HMAC signing for generic webhooks** — table stakes for B2B integrations (Stripe-style `t=<ts>,v1=<sig>` header).

### Data model deltas

- **User**: `notificationChannels` (array), `notificationPreferences` (per-event opt-in map).
- **New entity**: `IntegrationCredential` (`PK=USER#<id>`, `SK=INTEGRATION#<provider>`, encrypted `secret`, `meta`).

### Capability/tier impact

- `slack_integration`, `webhook_integration` — Strategist+. Scout gets email only.

### Success metrics

- **% of users with ≥1 non-email channel active**: target 30% within 60 days.
- **Time-to-acknowledge for critical alerts**: track via signed Slack button click-through.

### Critical files

- `Backend/src/shared/services/notifier.ts` — NEW (facade)
- `Backend/src/shared/services/notifiers/{email,slack,webhook}-adapter.ts` — NEW
- `Backend/src/functions/api/integrations/slack/{connect,oauth-callback,disconnect}.ts` — NEW
- `Backend/src/functions/api/integrations/webhook/{set-url,test}.ts` — NEW
- [Backend/src/functions/scheduled/send-alert.ts](Backend/src/functions/scheduled/send-alert.ts) — replace direct SES call
- [Backend/src/functions/scheduled/render-send-email.ts](Backend/src/functions/scheduled/render-send-email.ts) — replace direct SES call
- [Backend/src/functions/pipeline/deep-research.ts](Backend/src/functions/pipeline/deep-research.ts) — fire critical alert inline when delta significance >= 8
- `Frontend/src/app/(dashboard)/settings/integrations/page.tsx` — NEW
- [Backend/lib/stacks/api.stack.ts](Backend/lib/stacks/api.stack.ts) — new routes

### Risk

- Webhook URL leakage if encryption misconfigured. Mitigation: KMS CMK, never log the URL, log only the integration ID.
- Slack rate limits (1 msg/sec per webhook). Mitigation: queue on SQS if firing >5 alerts/min for a single user (rare but possible during onboarding burst).

---

## Phase 4 — Workspaces, Teams & Seats

**Goal**: Multi-tenant data model. A `Workspace` owns the Subscription + Competitors; Users are Members of a Workspace with roles (owner/admin/member). Unlocks agencies, team usage, and a much higher upgrade ceiling.

**Why now (and why later than 1–3)**: Highest blast radius — verified ~22 backend files contain ~56 direct `USER#<id>` query sites. Hard to reverse. Want product loop closed (Phase 1) and value layer mature (Phase 2) before disrupting the schema. Also: multi-channel delivery (Phase 3) becomes more sensible at workspace level than user level — moving credentials to Workspace is part of this phase.

### Scope

1. **New entities.**
   - `Workspace` — `PK=WORKSPACE#<wsId>`, `SK=PROFILE`. Fields: `name`, `ownerUserId`, `createdAt`, `subscriptionId`.
   - `Membership` — `PK=USER#<userId>`, `SK=MEMBERSHIP#<wsId>`, `role`, `joinedAt`. Mirror at `PK=WORKSPACE#<wsId>`, `SK=MEMBER#<userId>` for reverse lookup.

2. **Re-key existing entities.**
   - `Subscription`: `PK=USER#<id>` → `PK=WORKSPACE#<wsId>`. Migration: each existing user gets a default workspace, subscription moves to it.
   - `Competitor`: `PK=USER#<id>` → `PK=WORKSPACE#<wsId>`.
   - `IntegrationCredential` (from Phase 3): also moves to `WORKSPACE#`.
   - `Change`, `ResearchFinding`, `Recommendation` — stay on `COMP#<id>` (they're keyed on competitor, not user).

3. **One-shot migration Lambda.** `scripts/migrate-to-workspaces.ts` — for each existing User, create a Workspace named "<user.name>'s workspace", create owner Membership, copy Subscription + Competitor records to new PK, leave originals in place for 30 days behind a feature flag (`MIGRATION_LEGACY_READS=true`), then delete after row-count diff verification.

4. **API surface.**
   - `POST /workspaces` (create), `GET /workspaces` (list mine), `POST /workspaces/{id}/invitations` (invite by email), `POST /invitations/{token}/accept`, `DELETE /workspaces/{id}/members/{userId}` (kick).
   - Every authenticated handler gains an extra check: "is this user a member of the workspace this resource belongs to?" — extract `workspaceId` from the resource via a new `getResourceWorkspace()` helper.

5. **Frontend workspace switcher.** Top-bar dropdown showing user's workspaces; switching changes a `currentWorkspaceId` in localStorage; all API calls use it.

6. **Audit log foundation.** New entity `AuditEvent` (`PK=WORKSPACE#<wsId>`, `SK=AUDIT#<timestamp>`, `actorUserId`, `action`, `resourceId`, `meta`). Captures: invitations, role changes, member kicks, billing changes, integration connect/disconnect, GDPR export/delete. (Closes COMPLIANCE_ROADMAP Phase 5+ "audit log actor field" deferred item.)

### Architecture decisions

- **`Membership` written under both PKs (denormalized)** — avoids GSI for the most common reverse-lookup query.
- **Default workspace, not "personal mode"** — every user has at least one workspace; even single-seat users go through the workspace abstraction. Simpler than dual code paths.
- **Owner cannot leave** until ownership transferred. Owner cannot be kicked. Two-person rule for billing changes deferred.
- **Soft-delete during migration** — keep old `USER#<id>` rows for 30 days behind feature flag, then run a cleanup script.

### Data model deltas

Major. Detailed migration table:
| Entity | Before | After |
|---|---|---|
| User | `USER#<id>` / `PROFILE` | unchanged |
| Workspace | — | `WORKSPACE#<wsId>` / `PROFILE` |
| Membership | — | `USER#<id>` / `MEMBERSHIP#<wsId>` + `WORKSPACE#<wsId>` / `MEMBER#<id>` |
| Subscription | `USER#<id>` / `SUB` | `WORKSPACE#<wsId>` / `SUB` |
| Competitor | `USER#<id>` / `COMP#<id>` | `WORKSPACE#<wsId>` / `COMP#<id>` |
| Change/Research | `COMP#<id>` / ... | unchanged (still keyed on competitor) |
| IntegrationCredential | `USER#<id>` | `WORKSPACE#<wsId>` |
| AuditEvent | — | `WORKSPACE#<wsId>` / `AUDIT#<ts>` |

### Capability/tier impact

- New capability: `seats.max` — Scout 1, Strategist 5, Command 25.
- New capability: `seats.roles` — Scout `[owner]`, Strategist `[owner, member]`, Command `[owner, admin, member]`.

### Success metrics

- **% of paid workspaces with ≥2 members**: target 25% within 90 days post-launch.
- **Migration zero data loss**: validated by row-count diff pre/post.

### Critical files

Touches a lot. High-impact ones:
- [Backend/src/shared/db/keys.ts](Backend/src/shared/db/keys.ts) — new key builders
- `Backend/src/shared/types/{workspace,membership,audit-event}.ts` — NEW
- `Backend/src/shared/middleware/auth.ts` — extract `workspaceId` from JWT or header, validate membership
- `Backend/src/shared/utils/workspace-access.ts` — NEW (`assertCanAccess(userId, resourceId)`)
- All ~22 handler files: add `workspaceId` to query and access check (mostly mechanical)
- `Backend/src/scripts/migrate-to-workspaces.ts` — NEW one-shot
- `Frontend/src/components/layout/workspace-switcher.tsx` — NEW
- `Frontend/src/lib/api/workspaces.ts` — NEW
- [Frontend/src/lib/auth/use-auth.ts](Frontend/src/lib/auth/use-auth.ts) — extend with `currentWorkspaceId`

### Risk

- Migration data loss is the highest single risk in this whole roadmap. Mitigation: dry-run mode, feature flag for legacy reads, 30-day shadow period, row-count diff validation, extensive logging, can roll back by flipping the flag.

---

## Phase 5 — Onboarding & Top-of-Funnel

**Goal**: Lower friction at signup, raise activation rate.

**Why now**: Funnel improvements compound on every prior phase. Better to do this once the product is good enough that activated users actually retain (Phases 1–3 ship).

### Scope

1. **AI competitor discovery.** New onboarding step between "Company info" and "Competitors": user pastes their own URL, Sonnet returns 5–8 suggested competitors with rationale. User picks/edits. Massively lowers blank-page friction.
2. **Mobile responsive audit.** Full pass on dashboard, sidebar, onboarding, settings. Today the layout is desktop-first; founders read on phones. Tailwind breakpoint pass + sidebar collapse on mobile.
3. **First-run product tour.** 4-step coach-mark tour on first dashboard visit (sidebar → competitor card → recommendations card → digest preview).
4. **Onboarding analytics.** Funnel events: `signup_started`, `signup_completed`, `onboarding_step_n`, `onboarding_completed`, `first_research_complete`, `first_login_after_digest`. Stored as CloudWatch logs initially, queryable via Insights.
5. **Resend verification email.** Add explicit button on the post-signup screen if Cognito didn't deliver.

### Architecture decisions

- **Competitor discovery uses existing `callAnthropic` pattern** — new helper `suggestCompetitors(companyUrl, industry)`. ~$0.03/onboarding, acceptable.
- **Tour state in localStorage**, no backend state. Per-device.

### Capability/tier impact

- None — discovery is free at all tiers.

### Success metrics

- **Signup → onboarding-complete rate**: target +15%.
- **Onboarding-complete → first-week-engaged rate**: track but don't gate.
- **Mobile session share**: aim for >25% of dashboard sessions within 60 days.

### Critical files

- [Backend/src/shared/services/anthropic.ts](Backend/src/shared/services/anthropic.ts) — `suggestCompetitors()`
- `Backend/src/functions/api/onboarding/suggest-competitors.ts` — NEW
- `Frontend/src/components/onboarding/step-discover-competitors.tsx` — NEW
- [Frontend/src/app/onboarding/page.tsx](Frontend/src/app/onboarding/page.tsx) — insert new step
- `Frontend/src/components/dashboard/first-run-tour.tsx` — NEW
- All `Frontend/src/components/dashboard/**` — mobile responsive pass

### Risk

- AI competitor discovery could produce embarrassing misses (suggesting a non-competitor or missing the obvious one). Mitigation: ship with "edit / add manually" always visible, conservative count (5 suggestions, not 20), `confidence: low` items hidden behind "show more".

---

## Phase 6 — Tier Differentiation & Exports

**Goal**: Make Strategist→Command upgrade pressure real. Right now the only difference is competitor count + history days. After this phase, Command unlocks qualitatively-different capabilities.

**Why now**: Requires Phases 1, 2, 3 to have shipped (you can't gate Slack until Slack exists). Driver: revenue expansion.

### Scope

1. **Capability matrix as code.** Single source of truth in `shared/types/capabilities.ts`:
   ```typescript
   export const CAPABILITIES: Record<Tier, Capabilities> = {
     scout: { predictedMoves: false, recommendations: { maxVisible: 3 }, slackIntegration: false, webhookIntegration: false, pdfExports: false, csvExports: false, seats: { max: 1 }, ... },
     strategist: { predictedMoves: true, recommendations: { maxVisible: 10 }, slackIntegration: true, webhookIntegration: true, pdfExports: true, csvExports: true, seats: { max: 5 }, ... },
     command: { predictedMoves: true, recommendations: { maxVisible: -1 }, customRecommendationCategories: true, ..., seats: { max: 25 }, ... },
   };
   ```
   `hasCapability(workspace, 'pdfExports')` helper. Frontend `useCapability()` hook. Replace `PLAN_LIMITS` direct reads gradually.

2. **Board-ready PDF exports.** "Export weekly briefing as PDF" button — generates a branded multi-page PDF (cover, threat-ranked competitor table, key changes, recommendations, citations). Server-side generation via Puppeteer Lambda layer.
3. **CSV exports.** Changes, competitors, recommendations as CSV (for sales/marketing use). Lighter than PDF, useful at every tier above Scout.
4. **Scheduled report subscriptions.** Command tier: "send me a monthly executive PDF on the 1st of every month". Cron + delivery via notifier abstraction (Phase 3).
5. **Custom recommendation categories.** Command tier: workspace owner adds 1–3 custom focus areas (e.g. "ABM strategy", "channel strategy") that the recommendation generator targets.

### Architecture decisions

- **Capability matrix replaces PLAN_LIMITS for new gating** — leave existing PLAN_LIMITS reads in place during transition, prefer `hasCapability()` for all new code.
- **PDF generation via Puppeteer Lambda layer** — heavier than markdown→PDF but produces board-quality output. Keep in a separate state-machine task so cold-start latency doesn't bleed into user-facing requests. (Optional alternative: hosted DocRaptor / PDFShift at MVP — see Open Questions.)
- **Reuse existing email HTML** as the basis for PDF rendering — one template, two outputs.

### Data model deltas

- New entity: `ExportJob` — `PK=WORKSPACE#<wsId>`, `SK=EXPORT#<timestamp>`, `status`, `s3Url`, `expiresAt`. S3 presigned URL with 7-day expiry.

### Success metrics

- **Strategist → Command upgrade rate**: target +X% (set baseline first).
- **% of Command workspaces using ≥1 unique-to-Command capability**: >60% within 30 days of upgrade.

### Critical files

- `Backend/src/shared/types/capabilities.ts` — NEW
- `Backend/src/shared/utils/capability.ts` — `hasCapability()` helper
- `Backend/src/functions/api/exports/{create-pdf,create-csv,list,get-status}.ts` — NEW
- `Backend/src/functions/scheduled/render-pdf.ts` — NEW (Puppeteer)
- [Backend/lib/stacks/api.stack.ts](Backend/lib/stacks/api.stack.ts) — Puppeteer layer + new routes
- `Frontend/src/lib/hooks/use-capability.ts` — NEW
- `Frontend/src/components/dashboard/export-button.tsx` — NEW

### Risk

- Puppeteer cold starts (3–5s) hurt UX. Mitigation: PDF generation is async (returns 202 + presigned URL emailed when ready), no blocking UI wait.

---

## Phase 7 — UX Intelligence (Mute, Notes, Filters, Search)

**Goal**: Quality-of-life features that reduce noise and capture analyst context. Stops users from churning to "this is too noisy" / "I can't find what I noted last week".

**Why now**: Workspace abstraction (Phase 4) makes notes shared across the team — much higher value than single-user notes. Wait for it.

### Scope

1. **Mute / snooze.** Per-competitor and per-category mute toggles. Snooze: "ignore changes from competitor X for 30 days" — auto-expires. Respected by digest aggregator and notifier.
2. **Notes / annotations.** New `ChangeNote` entity. Free-text + `authorUserId` + timestamp. UI: comment thread under each change card.
3. **Threshold filters.** Per-workspace rule: "only show me changes with significance ≥ 5". Saved on workspace settings, applied across feed + digest.
4. **Saved views / dashboards.** "All product changes from competitors I've tagged 'enterprise'". Stored as `SavedView` entities; surface as left-sidebar items.
5. **Full-text search.** Cross-competitor search across changes + findings + recommendations. Implementation: DynamoDB doesn't do FTS natively — start with a scan-based search Lambda (`/search?q=...`) and tolerate 2–3s latency at < 10k records. Migrate to OpenSearch when search latency exceeds 5s p95 or storage exceeds 50k records per workspace.

### Architecture decisions

- **Mute is a workspace-level setting**, not per-user — avoids one user muting and another seeing different data.
- **Defer OpenSearch decision** — start with scan, migrate when it hurts.

### Data model deltas

- `Workspace.muteRules` (array), `Workspace.significanceThreshold` (number, default 0).
- `Competitor.snoozedUntil` (timestamp).
- New entities: `ChangeNote`, `SavedView`.

### Capability/tier impact

- `savedViews.max` — Scout 0, Strategist 5, Command 25.
- `notes` — all tiers.

---

## Phase 8 — Operational Maturity

**Goal**: Margin protection, prompt quality measurement, churn understanding, status visibility.

**Why now**: Earlier phases ship more features; this phase tightens the screws on operating them sustainably.

### Scope

1. **Prompt A/B testing framework.** `shared/services/prompt-registry.ts` keyed by `opName` + `version`. Each run logs `promptVersion` in `ai_call_completed`. Outcome variables (downstream metrics: `recommendation_acted_on`, `prediction_realized`, etc.) joined to prompt version offline. Decide promotion via Logs Insights query.
2. **Cancellation reason capture.** Paddle webhook `subscription.canceled` → trigger an exit-survey email asking why. One-line free-text + 5-option dropdown. Stored as `CancellationFeedback` entity. Surface as monthly summary email to owner.
3. **MRR / churn dashboard.** Owner-only admin route `/admin/business`. Pulls from Subscription + CostDay tables. Shows: MRR, ARR, MRR by tier, churn rate, gross margin (MRR – Anthropic cost), top 10 highest-cost users.
4. **Public status page.** Static page hosted on S3+CloudFront. Auto-updated by CloudWatch alarm state changes via SNS → Lambda → S3 write. Subscribed-to-by users via webhook integration.
5. **Retention nudges.** Email user 7 days after digest if they haven't logged in. Not weekly — capped at 1 per quarter to avoid spam.
6. **Source reputation weighting.** Maintain a small JSON file of known-reputable domains (TechCrunch, Reuters, official company sites). `deepResearch` finding citations get a `sourceQuality` score. Frontend dims low-quality citations.
7. **Citation deduplication.** Same URL across multiple findings → collapse to one citation chip in UI.

### Architecture decisions

- **A/B testing offline-only at MVP** — no traffic-splitting at request time, just version tagging + retrospective analysis. Avoids the need for a real experimentation framework.
- **Status page on S3+CloudFront**, not a 3rd-party tool — cheap, fully under control, mirrors the SOC 2 narrative ("we operate our own infrastructure").

---

## Phase 9 — Security & Compliance Hardening

**Goal**: Close the deferred items from `COMPLIANCE_ROADMAP.md` — the things every B2B procurement security questionnaire asks about.

### Scope

Direct lift from `COMPLIANCE_ROADMAP.md` deferred section, organized by impact:

1. **API Gateway throttling on auth endpoints** (Phase 4.2) — anti-bruteforce.
2. **AWS WAF** (Phase 4.6) — managed rules + custom rate-based rules + geo-block where applicable.
3. **CloudTrail enabled, multi-region trail, S3 bucket with object-lock** (Phase 5+) — required for SOC 2.
4. **`npm audit` in CI + Dependabot enabled** (Phase 4.3) — supply chain.
5. **Secret rotation runbook** (Phase 4.4) — quarterly rotation cadence documented; first rotation as a dry run.
6. **Logging hygiene audit** (Phase 4.8) — grep for credentials, emails, tokens in logs; sanitize.
7. **App-level audit log actor field** (Phase 5+) — Phase 4 already introduces `AuditEvent`; this phase adds `ipAddress`, `userAgent` and broader event coverage.
8. **Incident runbook** (Phase 5+) — markdown doc covering: AWS account takeover, Anthropic credential leak, customer data breach, sub-processor outage. Reviewed quarterly.
9. **OFAC SDN list auto-refresh cron** — currently hardcoded; add a weekly cron to fetch + diff + alert on changes.
10. **Re-consent banner for existing users** — when ToS/Privacy version bumps, prompt accept on next dashboard load.
11. **Lawyer review of policy text** — replace DRAFT placeholders on Privacy/ToS/DPA pages. External engagement.
12. **Right-to-restriction self-suspend endpoint** (Phase 3.4) — user-initiated account freeze without deletion.

### Architecture decisions

- **WAF before SOC 2 audit window** — auditors want to see this in place > 6 months.
- **CloudTrail in dedicated audit account** ideally, but org-of-1 means same account is acceptable for now; flag as "two-account" item for Phase 10.

---

## Phase 10 — Trust & Certifications

**Goal**: Formal third-party validation that lets you sell into any company.

### Scope

1. **SOC 2 Type 1 readiness assessment** — vendor-driven (Vanta / Drata / Tugboat). 8–12 weeks. Drives finalization of all Phase 9 items.
2. **SOC 2 Type 1 audit** — 4–8 weeks with audit firm.
3. **SOC 2 Type 2 audit** — requires 6–12 months of evidence post-Type 1.
4. **ISO 27001** — only if expanding internationally (EU/UK customers ask for it).
5. **GDPR DPA template** — lawyer-finalized, replace the DRAFT page with a real downloadable PDF.
6. **Customer security questionnaire library** — pre-filled answers to Vanta/SecurityPal/standardized vendor security questionnaires.

### Effort

XL — months of calendar time, mostly process not code. Significant external cost ($15–40k for SOC 2 Type 1, comparable for Type 2).

---

## Data Model Evolution (cross-phase)

Phases 1, 2, 3, 4, 6, 7, 8 all introduce new entities. Tracking the cumulative shape:

| Phase | New entities | Re-keyed entities | New User/Workspace fields |
|---|---|---|---|
| 1 | `CostDay` | — | User: `monthlyTokenBudget`, `monthToDateCostUsd`. Competitor: `researchCadenceDays`. |
| 2 | `Recommendation` | — | — |
| 3 | `IntegrationCredential` | — | User: `notificationChannels`, `notificationPreferences` |
| 4 | `Workspace`, `Membership`, `AuditEvent` | `Subscription`, `Competitor`, `IntegrationCredential` (move to `WORKSPACE#<wsId>`) | — |
| 6 | `ExportJob` | — | — |
| 7 | `ChangeNote`, `SavedView` | — | Workspace: `muteRules`, `significanceThreshold`. Competitor: `snoozedUntil`. |
| 8 | `CancellationFeedback` | — | — |

By the end of Phase 7 the entity set is: User, Workspace, Membership, Subscription, Competitor, Change, ResearchFinding, Recommendation, ChangeNote, SavedView, IntegrationCredential, ExportJob, AuditEvent, CostDay, CancellationFeedback. All single-table, all PK-composed by either `USER#`, `WORKSPACE#`, or `COMP#` prefix.

## Open Questions / Decisions Needed (before Phase 1 starts)

1. **Recurring research cadence per tier** — Scout weekly vs Scout fortnightly? Margin sensitivity is high. Recommendation: weekly for all tiers, but hard-cap monthly cost via Phase 1 kill-switch.
2. **Recommendation generation cost ceiling** — generating recs for every user every week is ~$0.05/user/week. At 1000 paying users, $200/month. OK to proceed unconditionally?
3. **Workspace migration timing** — defer until paid user count is below 200 (cleaner migration window) or do it sooner?
4. **Slack vs Teams first** — Slack first based on SMB market share, but if even one prospect blocks on Teams, reorder.
5. **PDF generation: Puppeteer Lambda layer vs hosted service (DocRaptor / PDFShift)** — layer is cheaper at scale, hosted is simpler MVP. Recommendation: hosted at MVP, migrate to Puppeteer if monthly bill > $50.

## Out of Scope (explicit)

- **Public API for power users** — tracked as future-future; not in this 10-phase plan.
- **Browser push notifications** — web push is fiddly; Slack covers the same need better.
- **Calendar integration** — nice-to-have, not in roadmap.
- **Industry benchmarks** (showing user's metric vs industry) — requires data partnership; defer until data network effects matter.
- **AI chatbot Q&A on dashboard** — trendy, premature.
- **CSV import for bulk competitor add** — add if asked.
- **SAML SSO** — add when first prospect requires it (typically Command-tier B2B sales).
- **Customer Health scoring** — useful internal tool but not customer-facing — defer.

## Verification approach (per phase)

Every phase ships with a verification checklist in its own implementation plan, written when that phase starts. At minimum, every phase must verify:

1. `cd Backend && npx tsc --noEmit` clean
2. `cd Frontend && npx tsc --noEmit && npm run lint` clean
3. `cdk synth` clean (no diff drift)
4. End-to-end smoke test from a real user account on the deployed environment
5. Logs Insights query confirms the new structured event is being emitted
6. CloudWatch alarms (if applicable) move to OK after deploy
7. No regression on the prior phase's success metric

## Recommended starting point

**Phase 1 first.** It's the only urgent item — without recurring research, every other phase is decorating a product whose loop is broken. Cost observability is paired because turning the cron on without margin visibility is reckless. Effort: ~1 focused session.

After Phase 1 ships and runs cleanly for 7 days (one full digest cycle), pick between Phase 2 (recommendations — biggest NPS lever) and Phase 3 (Slack — biggest retention lever) based on what the first batch of digest-cycle data tells you about engagement.

Phase 4 (workspaces) is the highest-blast-radius work in the entire plan — only start it once Phases 1–3 are stable and you have ≤200 paid users (cleaner migration window).
