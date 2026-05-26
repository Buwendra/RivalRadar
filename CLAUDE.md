# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RivalScan is an AI-powered competitive intelligence monitoring SaaS for SMBs. It scrapes competitor websites daily, uses Claude AI to analyze changes and their strategic implications, and delivers weekly strategic briefings via email. Priced at $49–$199/month to fill the gap between free tools (Google Alerts) and $20K+/year enterprise platforms (Crayon, Klue).

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui, deployed to **AWS Amplify** (standalone output mode). App ID `d1zrq9gf129s9u`; root dir `Frontend/`.
- **Backend**: AWS CDK (TypeScript) — fully serverless
  - API Gateway HTTP API v2 + Lambda (Node.js 20, ARM64)
  - DynamoDB (single-table, on-demand). The S3 snapshot bucket from `StorageStack` is still provisioned but unused — kept around to avoid deleting historical data.
  - Step Functions (3 state machines: WeeklyDigest, ResearchPipeline, ComparativeBriefing)
  - EventBridge Scheduler (several recurring jobs — three on Monday morning, plus daily cost/retention crons and a Sunday recurring-research enqueuer; see "Pipeline Flow" for the full set)
  - Cognito (auth) + SES (email) + Secrets Manager + CloudWatch + X-Ray
- **External Services**: Anthropic Claude API (deep research with native `web_search` tool, delta detection, threat scoring, weekly summaries) + Paddle (payments). Firecrawl was removed when deep research became the core change-detection engine.

## Architecture

```
Next.js (Amplify SSR) → API Gateway v2 → Cognito JWT → Lambda → DynamoDB

EventBridge (Mon  8am UTC) → WeeklyDigest SFN         → [Aggregate → Sonnet Summary → SES Email]
EventBridge (Mon 10am UTC) → ComparativeBriefing SFN  → [BrandCoverage → Sonnet Briefing → SES Email]   (Phase 24, opt-in)
Onboard / manual click     → ResearchPipeline SFN     → [DeepResearch (web_search) → SendAlert]
```

**8 CDK stacks** wired in `bin/app.ts` with explicit cross-stack dependencies:
Database → Storage → Auth → Email → Pipeline → API (receives `researchStateMachine` ARN) → Monitoring → StatusPage (Phase 8c — public S3+CloudFront `/status` site with auto-updater Lambda).
Stack naming: `RivalScan-${stage}-${StackType}` (stage from env context: dev/staging/prod).

The current product roadmap and design rationale lives in [ROADMAP.md](ROADMAP.md), [PRODUCT_GAPS_ROADMAP.md](PRODUCT_GAPS_ROADMAP.md), [COMPLIANCE_ROADMAP.md](COMPLIANCE_ROADMAP.md), and [PREDICTIONS_AND_TAGS.md](PREDICTIONS_AND_TAGS.md) at the project root. Treat those as the source of truth for what's shipped vs. what's planned.

## Commands

### Backend (`Backend/`)

```bash
cd Backend
npm install                          # Install dependencies
npx tsc --noEmit                     # Type-check
npx cdk synth                        # Generate CloudFormation
npx cdk deploy --all                 # Deploy all stacks
npx cdk diff                         # Preview changes
npx vitest                           # Run all tests
npx vitest --watch                   # Tests in watch mode
npx vitest src/path/to/file.test.ts  # Run a single test file
```

Tests are colocated next to source as `*.test.ts`. `vitest.config.ts` includes both `test/**/*.test.ts` and `src/**/*.test.ts` — if you add tests in a new place, confirm one of those patterns matches.

### Frontend (`Frontend/`)

```bash
cd Frontend
npm install              # Install dependencies
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
```

## Key Patterns & Conventions

### Backend Handler Pattern

All API Lambda handlers use the `apiHandler()` wrapper from `shared/middleware/`. This provides automatic CORS headers, JSON parsing, OPTIONS handling, request logging, and error catching. Handlers receive either `AuthenticatedEvent` (Cognito JWT) or `PublicEvent`.

```typescript
// Standard handler skeleton (post-Phase 4a tenancy)
export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);
  const body = validate(schema, parseBody(event));
  const ctx = await resolveTenantContext(
    email,
    getRequestedWorkspaceId(event.headers as Record<string, string | undefined>)
  );
  // ctx.tenantUserId — workspace owner, key entities under this
  // ctx.callerUserId — actual signed-in user (use for audit attribution)
  // ctx.workspaceId / ctx.workspaceName / ctx.role
  return { statusCode: 200, body: { data: result } };
});
```

**Public routes that need to emit non-JSON responses (e.g. `Location:` header for a 302 redirect)** must bypass `apiHandler` — the wrapper hardcodes `Content-Type: application/json`. See `api/public/battlecard.ts` for the pattern.

### Backend Path Aliases (tsconfig)

- `@shared/*` → `./src/shared/*`
- `@functions/*` → `./src/functions/*`

### Frontend Path Alias (tsconfig)

- `@/*` → `./src/*`

### API Response Envelope

All API responses follow: `{ data?, error?: { code, message, details? }, meta?: { cursor?, hasMore } }`

### Pagination

Cursor-based using DynamoDB `LastEvaluatedKey` → base64url-encoded JSON string. Clients pass cursor back as query param. Frontend uses TanStack Query `useInfiniteQuery` with `getNextPageParam` reading `meta.cursor`.

### Frontend Data Flow

API calls: `lib/api/client.ts` (`apiClient<T>` / `apiClientWithMeta<T>`) → domain modules (`lib/api/{resource}.ts`) → TanStack Query hooks (`lib/hooks/use-{resource}.ts`) → components.

Auth tokens stored in localStorage with `rs_` prefix. `apiClient` auto-injects Bearer token when `requireAuth: true` (default). Auto-redirects to `/sign-in` on 401.

**Cognito token gotcha**: `apiClient` must send `rs_id_token` (not `rs_access_token`) because the backend's `getUserEmail()` reads the `email` JWT claim, which only appears in Cognito **ID tokens** — access tokens contain only `sub`/`username`. Changing this reintroduces "Missing email claim" 401s on every authenticated route.

### Frontend Global Query Config

`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false` (set in `lib/providers/app-providers.tsx`).

### Auth Flow

Cognito JWT → tokens in localStorage → `AuthProvider` hydrates on mount, checks token expiry every 60s → `AuthGuard` component wraps protected routes and enforces onboarding completion.

### Workspaces & Tenancy (Phase 4a/b/c)

Every authenticated handler resolves a **TenantContext** before doing any work — `resolveTenantContext(email, requestedWorkspaceId?)` in `shared/middleware/tenant.ts` translates the JWT email into:
- **`tenantUserId`** — the workspace owner's userId; all shared entities (Competitor, Subscription, Recommendation, SavedView, Battlecard, etc.) are keyed under `USER#<tenantUserId>` so every member of the workspace sees the same data.
- **`callerUserId`** — the actual signed-in user. Use for audit attribution + caller-scoped entities (Notification, AuditEvent actor, ApiKey creator).
- **`workspaceId`, `workspaceName`, `role`** — workspace identity + the caller's role.

Resolution order: email → `callerUserId` (GSI3) → memberships under `USER#<callerUserId>` / SK `MEMBERSHIP#`. If the caller has multiple workspaces, the **`X-Workspace-Id`** header (sent by the frontend from `localStorage.rs_current_workspace_id`) picks the active one; otherwise the resolver falls back to the caller's own workspace. Legacy users with no memberships return `tenantUserId === callerUserId`.

**Three-role hierarchy (Phase 14):** `owner > admin > member`. Owners can do anything; admins can invite/remove members and edit content; members are read-only-ish. Role gates live in handlers — search for `requireOwner` / `requireAdminOrOwner`. Admins **cannot invite other admins** — that's gated to owners only to prevent admin-as-second-owner attacks.

**Ownership transfer (Phase 4c):** uses `tenantUserId` (immutable, the original creator) vs `ownerUserId` (mutable, current owner) split with a lazy resolver fallback — no data migration needed.

### Capability Gating (Phase 6 / Phase 19 / Phase 20)

Tier-gated features go through `hasCapability(user, 'pdfExports')` from `shared/utils/capability.ts`, fed by the `CAPABILITIES` matrix in `shared/types/capabilities.ts`. The frontend mirrors this manually in `Frontend/src/lib/utils/capabilities.ts` + `lib/hooks/use-capability.ts` — when adding a new capability flag, update **both files** plus the union type on `hasCapability`'s parameter and the `useCapability` hook. Backend remains the enforcement source of truth; frontend uses the mirror only for UI gating (showing/hiding upgrade prompts, disabling buttons).

Current capability flags: `pdfExports`, `csvExports`, `slackIntegration`, `webhookIntegration`, `predictedMoves`, `customRecommendationCategories`, `scheduledReports`, `apiAccess`, `comparatorMatrix`, `brandPulse` (Phase 23 — self-brand monitoring + Phase 24 comparative analytics, true on all tiers). Numeric capacity flags (`recommendations.maxVisible`, `seats.max`, `savedViews.max`, `apiKeys.max`) are read directly from `capabilitiesFor(user)` rather than via the boolean check.

### Public API (Phase 11/13)

**`/v1/*` routes are X-API-Key authenticated, NOT Cognito.** Routes registered in `api.stack.ts` with `auth: false` and a separate middleware `resolveApiKeyContext()` that hashes the incoming key (SHA-256), looks up the row by `APIKEY#<hash>` PK, and returns the workspace + scope. Keys have a `scope` enum (`'read'` default / `'write'`) — write-scope routes (`POST /v1/competitors`, `PATCH /v1/recommendations/{id}`) reject read-only keys at the handler. Pre-Phase-13 keys default to `'read'` via `keyRow.scope ?? 'read'` so nothing breaks.

### Public token-share routes

Several public routes are token-validated rather than auth'd: invitations (`/invitations/{token}/accept`), cancellation feedback (`/cancellation-feedback/{token}`), public battlecards (`/public/battlecards/{token}`). Pattern: ULID token in the URL path, looked up via either a dedicated PK (`INVITE#<token>`, `CANCEL_FEEDBACK#<token>`) or a GSI3 reverse-index (`BATTLECARD_TOKEN#<token>`). Validate `expiresAt` (epoch seconds) explicitly even though DDB TTL is set — TTL has up to 48h delay.

### In-app notifications (Phase 18)

Per-user, polling-based feed. Fire-and-forget `enqueueNotification()` in `shared/services/notifications.ts` mirrors `recordAuditEvent` — write failures log + continue, never roll back the underlying mutation. Storage: `USER#<recipientUserId>` / `NOTIF#<ts>#<ulid>`, 90-day TTL. Notification kinds: `invitation.accepted`, `workspace.member_removed`, `workspace.role_changed`, `workspace.ownership_received`, `workspace.ownership_handed_off`. Frontend polls every 60s via `useNotifications()`.

### ID Generation

Uses ULID (`generateId()` in `shared/utils/id.ts`) — time-sortable, conflict-free.

### Secrets

Lazy-loaded singleton with 5-minute TTL cache (`shared/services/secrets.ts`). Pulls from AWS Secrets Manager (`rivalscan/api-keys`): `PADDLE_SECRET_KEY`, `PADDLE_WEBHOOK_SECRET`, `FIRECRAWL_API_KEY`, `ANTHROPIC_API_KEY`.

### AI Models & Anthropic call patterns

All Anthropic calls go through `callAnthropic()` in `shared/services/anthropic.ts` — a thin `fetch` wrapper that retries on 429 with backoff (honors `retry-after` header, default 65s, max 2 retries). Use it for any new Claude call you add; do not call `fetch('.../v1/messages')` directly.

- **Claude Sonnet 4.5** (alias `claude-sonnet-4-5`):
  - `deepResearch()` — research with native `web_search_20250305` tool, max 8 uses/run, max_tokens 4096
  - `detectResearchDeltas()` — compares prior vs current `ResearchFinding`, max_tokens **16384** (large because it generates detailed deltas + impact analysis). Has a `parseDeltasJson()` helper that does **partial JSON recovery** if Claude truncates mid-array — salvages every complete delta object before the cut-off rather than discarding the whole response.
  - `generateWeeklySummary()` — strategic briefing prose for the competitive digest email
  - `generateComparativeBriefing()` — PR-flavoured briefing for the Phase 24 Comparative Briefing email; returns prose + 2–3 suggested narrative angles. max_tokens 1500, ~$0.01–0.02/call. Soft-degrades to raw text if the JSON envelope can't be parsed.
  - `predictNextMoves()` — forward-looking 30/60/90-day predictions per competitor (~$0.02)
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`):
  - `scoreCompetitorThreat()` — 1-2 sentence threat rationale + level (~$0.002/call)
  - `suggestWinAgainstTactics()` — 3-5 sales-enablement tactics for the battlecard (Phase 21, ~$0.005/call); cached on the Competitor record keyed by `winAgainstTacticsResearchId` so regenerating the same battlecard within one research cycle skips the call.
  - `classifyResearchTarget()` — pre-research input classifier rejecting person names / sanctioned entities (Compliance Phase 1)
  - `analyzeChange()` (legacy, unused after the deep-research refactor — kept for reference)

All AI surfaces (dashboard cards, weekly digest email, battlecard PDF) carry an AI disclaimer footer — see `Frontend/src/components/dashboard/ai-disclaimer.tsx` and the footer line in the PDF renderers.

**Do not pin Sonnet to a dated snapshot without confirming it exists.** A bad snapshot ID (`claude-sonnet-4-5-20241022`, which is actually a 3.5 Sonnet date) shipped once and caused silent 404s. The alias `claude-sonnet-4-5` is the safe default.

### AI Deep Research (web_search tool)

`deepResearch()` uses Anthropic's `web_search_20250305` **server tool** — Claude manages the search loop internally, no client-side tool-use loop is needed. Single `fetch` call returns `content[]` with a mix of `text`, `server_tool_use`, and `web_search_tool_result` blocks; citations come from `web_search_tool_result`, the structured JSON answer from the final text block. The prompt asks for findings in 5 categories (`news`/`product`/`funding`/`hiring`/`social`) plus a `derivedState` summary block (`stage`, `fundingState`, `hiringState`, `strategicDirection`, `techPositioning`, `pacing`, `evidenceNotes`) and per-finding `sentiment` + `timeSensitivity` metadata.

The `targetKind` parameter (Phase 23) swaps the prompt framing: `'competitor'` (default) frames the analysis from a competitive-intelligence POV; `'self'` reframes as media intelligence ("how is the market perceiving X?") so the same engine produces brand-monitoring findings. Output schema is identical so the downstream pipeline (delta detection, persistence, enrichment) is untouched.

Triggered automatically on onboarding (in `users/onboard.ts`) to populate day-1 data, and manually via `POST /competitors/{id}/research`. Each run writes one `ResearchFinding` to DynamoDB plus a `Change` record per detected delta. Cost: ~$0.30/run end-to-end.

### Per-competitor enrichment (momentum / threat / tags)

After every research run, `deep-research.ts` runs a post-research enrichment block that writes computed signals back to the **Competitor** record in a single `updateItem` call:

- **`momentum`** (rule-based, free) — `'rising' | 'stable' | 'slowing' | 'declining' | 'insufficient-data'` + `momentumChangePercent`. Computed by `computeMomentum()` in `shared/utils/competitor-metrics.ts` from a 30-day Change-count series; bucket thresholds at +25% / -15% / -40%; `insufficient-data` if total changes in 14d < 3.
- **`threatLevel`** (Haiku) — `'critical' | 'high' | 'medium' | 'low' | 'monitor'` + `threatReasoning` (1-2 sentence rationale). Computed by `scoreCompetitorThreat()`; reads user company context, latest finding's `derivedState`, recent significant changes, and momentum.
- **`derivedTags`** (rule-based, free) — array of up to 6 slug-style tags (e.g. `growth-stage`, `just-raised`, `hiring-aggressively`, `ai-native`, `going-upmarket`). Computed by `deriveTagsFromState()` with priority-ordered rules (concerns > funding events > stage > hiring > strategy > tech > pacing > deprioritize). Frontend `CompetitorTagChips` maps slugs to display labels + tones via a `TAG_CONFIG` dictionary.

The enrichment block is wrapped in try/catch — Haiku failures don't break momentum/tags writes. Sidebar list sort order is **threat desc → momentum desc → name asc** (see `Frontend/src/components/layout/dashboard-sidebar.tsx`).

**Self-brand carve-outs (Phase 23):** when the Competitor row has `targetKind === 'self'`, `deep-research.ts` skips `scoreCompetitorThreat()` and the entire predicted-moves block (evaluating + generating) — both are conceptually nonsensical for your own brand. Momentum still runs (your own activity is a valid signal). `deriveTagsFromState()` routes to a separate `deriveSelfBrandTags()` rule set with brand-flavoured slugs (`coverage-rising`, `narrative-funding-buzz`, `media-quiet`, etc.) so the same `CompetitorTagChips` component renders sensible labels for both.

### Brand Pulse — self-brand monitoring (Phase 23)

The workspace's own brand is monitored using the same deep-research engine as competitors, persisted as a **Competitor row with `targetKind: 'self'`**. Exactly one self row per workspace; created at onboarding when the user supplies `companyWebsite`, or via the `POST /brand/setup` endpoint for legacy users (renders an empty-state CTA on the Your Brand page).

The discriminator approach (vs a separate Brand entity) means every key builder, query helper, enrichment block, and the entire `deep-research.ts` Lambda is reused as-is. The cost is a **filter-discipline rule**: every endpoint that lists competitors must exclude self rows. Use `competitorsOnly()` / `isCompetitorTarget()` from `shared/utils/competitor-target.ts`. Already applied to: `competitors/list`, `competitors/create` + `bulk-import` (so self doesn't consume a plan-limit slot), `v1/competitors` + `v1/competitors-create`, `search`, the weekly digest pipeline (aggregate-changes, generate-recommendations, send-saved-view-digests), the PDF/CSV exports. Account delete and GDPR export deliberately do NOT filter — they want everything. `competitors/get` and `competitors/research` 404 on self rows so the UI surface stays consistent.

The self-brand surface is `/brand/*`: `GET /brand`, `POST /brand/research`, `GET /brand/coverage`, `GET /brand/sentiment`, `GET /brand/health` (Phase 24), `POST /brand/setup`. Handlers share `loadSelfBrand()`, `loadUserForBrand()`, and `assertBrandPulseCapability()` from `api/brand/_shared.ts`. The frontend mirror is at `Frontend/src/app/(dashboard)/dashboard/your-brand/`.

### Comparative analytics (Phase 24)

Three features built on Phase 23, gated by the same `brandPulse` capability:

- **Share of Voice** — `GET /analytics/share-of-voice?window=7d|30d|90d` returns per-entity coverage breakdown across the 5 research categories. Pure aggregation in `shared/utils/share-of-voice.ts` over recent Change records. Window is clamped to the tier's `PLAN_LIMITS[plan].historyDays`. Frontend renders at `/dashboard/compare/share-of-voice` using `ShareOfVoiceChart` (stacked horizontal bars, no chart library).
- **Brand Health Score** — `GET /brand/health` returns a composite 0–100 KPI + three components (sentiment / voice / momentum) + a `confidence` bucket (`low | medium | high`) based on mention volume. Pure rules in `shared/utils/brand-health.ts` with the formula `round((sentimentScore + voiceScore + momentumScore) / 3)` — no AI cost. Card rendered by `BrandHealthScoreCard` (default variant on Your Brand, `size="sm"` on the dashboard home).
- **Comparative Weekly Briefing** — PR-flavoured email variant running on its own state machine (`ComparativeBriefing`) at Mon 10am UTC. Opt-in via `notificationPreferences.email.comparativeBrief === true`. Pipeline: `get-comparative-subscribers` (opt-in + capability + self-row existence filter) → MAP(maxConcurrency=5) → `aggregate-brand-coverage` → `generate-comparative-briefing` (Sonnet) → `render-send-comparative-brief` (SES via the email-only adapter, NOT `dispatchWeeklyDigest()` because that's gated by the `weeklyDigest` preference and fans out to Slack/webhook). The Mon 10am slot is chosen to offset cleanly from the existing Mon 8am competitive digest and Mon 9am saved-view digests.

Both pure-aggregation utils have colocated unit tests (`share-of-voice.test.ts`, `brand-health.test.ts`) — useful templates for any future Phase 25+ scoring work.

### Step Functions concurrency

`MapResearch` in `pipeline.stack.ts` uses **`maxConcurrency: 1`** to serialize per-minute Anthropic token usage and avoid rate-limit pile-ups during multi-competitor onboarding. Each research run can burn 10-20k input tokens across 2-3 Sonnet calls; running 3 in parallel reliably trips the 30k input-tokens-per-minute org limit. If you change this back to >1, re-test multi-competitor onboarding.

### Analytics events (Phase 5)

Funnel events are emitted as structured JSON via `logger.info(eventName, metadata)` and queryable via CloudWatch Logs Insights. Events: `signup_started`, `signup_completed`, `signin_attempt`, `signin_succeeded`, `signin_failed`, `verification_resent`, `onboarding_completed`, `first_research_completed`, `recommendation_acted_on`, `recommendation_dismissed`. Insights example: `filter message = "onboarding_completed" | stats count(*) by bin(1d)`. **No client-side tracking pixel** — every event fires from a backend handler at the known transition point. Don't grep the frontend for these names.

## DynamoDB Single-Table Design

| Entity | PK | SK | Notes |
|--------|----|----|----|
| User | `USER#<id>` | `PROFILE` | |
| Subscription | `USER#<id>` | `SUB` | |
| Competitor | `USER#<tenantUserId>` | `COMP#<id>` | shared across workspace; carries `targetKind: 'competitor' \| 'self'` (Phase 23, default `'competitor'`) |
| Change | `COMP#<id>` | `CHANGE#<timestamp>` | |
| ResearchFinding | `COMP#<id>` | `RESEARCH#<timestamp>` | carries `derivedState` |
| Recommendation | `USER#<tenantUserId>` | `REC#<timestamp>` | Phase 2 |
| ChangeNote | `COMP#<id>` | `NOTE#<changeId>#<ts>` | Phase 7a analyst notes |
| IntegrationCredential | `USER#<tenantUserId>` | `INTEGRATION#<provider>` | Phase 3 |
| CostDay | `USER#<id>` | `COST#<YYYY-MM-DD>` | Phase 1 cost rollup |
| Workspace | `WORKSPACE#<id>` | `PROFILE` | Phase 4a |
| Membership (per-user) | `USER#<userId>` | `MEMBERSHIP#<workspaceId>` | Phase 4a |
| Member (per-workspace) | `WORKSPACE#<id>` | `MEMBER#<userId>` | Phase 4a |
| Invitation | `INVITE#<token>` | `META` | token-share, Phase 4a |
| AuditEvent | `WORKSPACE#<id>` | `AUDIT#<ts>#<id>` | Phase 4b |
| SavedView | `USER#<tenantUserId>` | `VIEW#<id>` | Phase 7b |
| SavedViewSubscription | `USER#<subscriberUserId>` | `VIEW_SUB#<workspaceId>#<viewId>` | Phase 15 |
| ApiKey (auth lookup) | `APIKEY#<sha256(key)>` | `META` | Phase 11, hashed |
| ApiKey (workspace mirror) | `WORKSPACE#<id>` | `APIKEY#<id>` | for the list endpoint |
| Notification | `USER#<recipientUserId>` | `NOTIF#<ts>#<id>` | Phase 18, 90-day TTL |
| Battlecard | `USER#<tenantUserId>` | `BATTLECARD#<ts>#<id>` | Phase 20, 30-day TTL, GSI3 token lookup |
| CancellationFeedback | `CANCEL_FEEDBACK#<token>` | `META` | Phase 8b, token-share |
| OFAC SDN drift tracker | `OFAC_SDN` | `META` | Compliance Phase 1, drift cron |

The `Snapshot` entity from the original Firecrawl pipeline is no longer written. Old snapshot rows from before the deep-research refactor still exist (and the SK prefix `SNAP#` is reserved) but no code path reads them today.

**GSIs**:
- **GSI1** — user's combined feed; stores `CHANGE#<ts>`, `RESEARCH#<ts>`, and `REC#<ts>` SK prefixes (filter with `begins_with`)
- **GSI2** — all active competitors (PK=`ACTIVE`); originally for the daily cron, still used by Step Function input collectors
- **GSI3** — multi-purpose reverse index keyed by `GSI3PK`:
  - `<email-lowercased>` → user by email (every authenticated route's first step)
  - `BATTLECARD_TOKEN#<token>` → public battlecard share-token lookup (Phase 20)

The **Competitor** record carries derived intelligence written by the enrichment block: `momentum`, `momentumChangePercent`, `momentumAsOf`, `threatLevel`, `threatReasoning`, `threatAsOf`, `derivedTags`, `derivedTagsAsOf`, `predictedMoves`, `predictionHistory`. Plus the lazy-populated `winAgainstTactics` cache (Phase 21) keyed by `winAgainstTacticsResearchId` so battlecard regeneration within one research cycle skips the Claude call. All read directly by the list/detail endpoints without recomputation. **`targetKind`** (Phase 23) discriminates competitor vs self-brand rows; threat/predicted-moves fields stay unset for self rows.

The **User** record gained `companyWebsite?` (Phase 23) — seeds the self-brand Competitor row at onboarding or via `POST /brand/setup`.

Key builders in `shared/db/keys.ts`. Query helpers (`getItem`, `putItem`, `queryByPK`, `queryGSI`, `updateItem`) in `shared/db/queries.ts`. Pure-function metrics (`computeMomentum`, `buildChangesByDay`, `deriveTagsFromState`) live in `shared/utils/competitor-metrics.ts`; SoV and Brand Health utilities (`computeShareOfVoice`, `computeBrandHealthScore`) in `shared/utils/share-of-voice.ts` and `shared/utils/brand-health.ts`; the self-vs-competitor filter helpers (`isCompetitorTarget`, `competitorsOnly`) in `shared/utils/competitor-target.ts`.

## Pipeline Flow (Step Functions)

**Research pipeline** (`Backend/src/functions/pipeline/deep-research.ts` — single Lambda, mapped over competitors with `maxConcurrency: 1`, then chained to `send-alert`):

The `deep-research` Lambda owns the full per-competitor flow internally — there are no smaller chained Lambdas like the old daily pipeline had. Order matters:

1. **Load prior `ResearchFinding`** from DynamoDB (newest first via descending SK scan, may be null on first run)
2. **`deepResearch()`** — Sonnet + web_search → current findings, citations, derivedState
3. **`detectResearchDeltas()`** — Sonnet compares prior vs current, returns array of new items with impact analysis. **Runs BEFORE persisting the new finding** so a Claude failure leaves the prior baseline intact for clean retry.
4. **Persist new `ResearchFinding`** with full `derivedState`
5. **Persist each delta as a `Change` record** (with `researchId`, `citations`, `sourceCategory` fields)
6. **Enrichment block** (best-effort, won't fail the run):
   - Query last 30d of changes once → use for both momentum + threat input
   - Compute momentum (rule-based)
   - Load user profile for company name + industry
   - Score threat level via Haiku
   - Derive tag chips
   - Single `updateItem` writes momentum/threat/tags + their `*AsOf` timestamps to the Competitor record atomically
7. **Return** `{ storedChanges[] }` for the chained `SendAlertTask` (emails user if any delta has significance ≥ 7)

Lambda timeout 5 min, memory 1024 MB (web_search responses can be large).

**Weekly competitive digest** (`Backend/src/functions/scheduled/`):
1. `get-subscribers` → 2. `aggregate-changes` (top 10 by significance, past 7 days via GSI1) → 3. `generate-summary` (Claude Sonnet) → 4. `generate-recommendations` (Claude Sonnet) → 5. `render-send-email` (SES). MAP wrapper, maxConcurrency=5.

**Comparative briefing (Phase 24)** — opt-in, separate state machine, same Map shape:
1. `get-comparative-subscribers` (opt-in + `brandPulse` capability + self-row existence) → 2. `aggregate-brand-coverage` (self + competitor mention counts, sentiment breakdown, SoV) → 3. `generate-comparative-briefing` (Sonnet, soft-degrades on JSON parse failure) → 4. `render-send-comparative-brief` (email-only via `sendEmailNotification`, bypasses `dispatchWeeklyDigest()`).

**Trigger entry points for the research pipeline**:
- Onboarding completion (`api/users/onboard.ts`) starts the ResearchPipeline with all newly-created competitors AND the self-brand row when `companyWebsite` was provided
- Manual "Research Now" buttons: `POST /competitors/{id}/research` for a single competitor, `POST /brand/research` for the self-brand row
- Sunday 6am UTC recurring-research enqueuer (`scheduled/enqueue-recurring-research.ts`) walks the active-competitor index and re-runs research based on each row's `researchCadenceDays` (or the tier default from `PLAN_LIMITS`)

**Other EventBridge schedules** (all in `pipeline.stack.ts`):
- Mon  8am UTC — WeeklyDigest state machine
- Mon  9am UTC — `send-saved-view-digests` Lambda (Phase 15)
- Mon 10am UTC — ComparativeBriefing state machine (Phase 24)
- Sun  6am UTC — recurring-research enqueuer
- Daily 3am UTC — `aggregate-ai-costs` (per-user CostDay rollup, drives monthly cost-cap enforcement)
- Daily 4am UTC — `send-retention-nudges` (Phase 8a, 90-day per-user cooldown)
- 1st of month 8am UTC — `send-scheduled-reports` (Phase 6c, Command-tier PDF briefing)

## Pricing Tiers & Plan Limits

| Tier | Price | Max Competitors | History |
|------|-------|-----------------|---------|
| Scout | $49/mo | 3 | 30 days |
| Strategist | $99/mo | 10 | 90 days |
| Command | $199/mo | 25 | 1 year |

Defined in `PLAN_LIMITS` from `shared/types/index.ts`. Enforced in `competitors/create.ts`. Payments handled via Paddle (checkout sessions, customer portal, webhook lifecycle events).

## Environment Variables

**Backend Lambda** (set via CDK): `TABLE_NAME`, `BUCKET_NAME`, `USER_POOL_ID`, `USER_POOL_CLIENT_ID`, `SECRETS_ARN`, `FRONTEND_URL`, `FROM_EMAIL`. Lambdas that trigger the research state machine (`api/users/onboard.ts`, `api/competitors/research.ts`, `api/brand/research.ts`, `api/brand/setup.ts`) get `RESEARCH_PIPELINE_ARN`. Subscription checkout gets `PADDLE_PRICE_SCOUT`/`_STRATEGIST`/`_COMMAND`. (`DAILY_PIPELINE_ARN` is gone with the daily scrape pipeline.)

**CDK deploy** (required for `cdk deploy`): `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION` (defaults to us-east-1), `FRONTEND_URL` (for API CORS — **must match the Amplify URL exactly**, e.g. `https://main.d1zrq9gf129s9u.amplifyapp.com`, or CORS blocks the browser), `FROM_EMAIL`, `PADDLE_PRICE_*`. `bin/app.ts` validates `CDK_DEFAULT_ACCOUNT` and `FRONTEND_URL` at synth time. A populated `Backend/.env` can be sourced with `set -a && source .env && set +a`.

**Frontend** (Amplify app-level env vars): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`. **These are inlined at build time**, not read at runtime — after changing them in Amplify console you MUST trigger a rebuild (`aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE`), otherwise the old localhost-fallback bundle keeps serving.

## Deploy Notes

- **Backend** deploys via `cdk deploy --all` from `Backend/` after sourcing `.env`. Individual stacks: `cdk deploy RivalScan-dev-Pipeline RivalScan-dev-Api`.
- **Frontend** deploys automatically on push to `main` (Amplify tracks the GitHub repo). Manual: `aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE`.
- AWS region is **us-east-1**. Paths with leading `/` (CloudWatch log group names, IAM ARNs) passed to `aws` CLI from Git Bash on Windows get mangled — prefix with `MSYS_NO_PATHCONV=1`.
- `cdk synth` requires `FRONTEND_URL` and `CDK_DEFAULT_ACCOUNT` set or `bin/app.ts` throws at parse time — handy when scripting verification.

## PDF generation lambdas (Phase 6b / Phase 20)

Two PDF surfaces exist: the weekly briefing (`api/exports/pdf.ts` → `shared/utils/pdf-renderer.ts`) and the per-competitor battlecard (`api/competitors/battlecard.ts` → `shared/services/battlecard-pdf.ts`). Both use **PDFKit** + **S3** + **presigned URLs** (no Puppeteer).

Each PDF lambda is wired in `api.stack.ts` outside `addRoute()` because it needs the same memory/timeout override **and** a custom `commandHooks.afterBundling` that copies PDFKit's `.afm` font metric files into the lambda bundle — esbuild treats them as binary assets and won't bundle them automatically. **If you add a third PDF lambda, copy this hook verbatim** — without the .afm files, PDFKit cold-starts throw `Cannot find module ... data/Helvetica.afm`. Memory: 1024 MB. Timeout: 60s.

The battlecard route serves PDFs through `GET /public/battlecards/{token}` (no auth) which **bypasses `apiHandler`** to emit a `Location:` header for a 302 redirect to a fresh 1-hour S3 presigned URL. Mirror that pattern if you add other public-share endpoints that return non-JSON.
