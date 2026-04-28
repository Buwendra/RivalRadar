# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RivalScan is an AI-powered competitive intelligence monitoring SaaS for SMBs. It scrapes competitor websites daily, uses Claude AI to analyze changes and their strategic implications, and delivers weekly strategic briefings via email. Priced at $49–$199/month to fill the gap between free tools (Google Alerts) and $20K+/year enterprise platforms (Crayon, Klue).

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui, deployed to **AWS Amplify** (standalone output mode). App ID `d1zrq9gf129s9u`; root dir `Frontend/`.
- **Backend**: AWS CDK (TypeScript) — fully serverless
  - API Gateway HTTP API v2 + Lambda (Node.js 20, ARM64)
  - DynamoDB (single-table, on-demand). The S3 snapshot bucket from `StorageStack` is still provisioned but unused — kept around to avoid deleting historical data.
  - Step Functions (2 state machines: weekly digest, research pipeline)
  - EventBridge Scheduler (Monday 8am UTC for the weekly digest only — there is **no** daily cron)
  - Cognito (auth) + SES (email) + Secrets Manager + CloudWatch + X-Ray
- **External Services**: Anthropic Claude API (deep research with native `web_search` tool, delta detection, threat scoring, weekly summaries) + Paddle (payments). Firecrawl was removed when deep research became the core change-detection engine.

## Architecture

```
Next.js (Amplify SSR) → API Gateway v2 → Cognito JWT → Lambda → DynamoDB

EventBridge (Mon 8am UTC) → WeeklyDigest SFN    → [Aggregate → Sonnet Summary → SES Email]
Onboard / manual click    → ResearchPipeline SFN → [DeepResearch (web_search) → SendAlert]
```

**7 CDK stacks** wired in `bin/app.ts` with explicit cross-stack dependencies:
Database → Storage → Auth → Email → Pipeline → API (receives `researchStateMachine` ARN) → Monitoring.
Stack naming: `RivalScan-${stage}-${StackType}` (stage from env context: dev/staging/prod).

The current product roadmap and design rationale lives in [ROADMAP.md](ROADMAP.md) and [PREDICTIONS_AND_TAGS.md](PREDICTIONS_AND_TAGS.md) at the project root. Treat those as the source of truth for what's shipped vs. what's planned.

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
// Standard handler skeleton
export const handler = apiHandler(async (event) => {
  const email = getUserEmail(event);           // Extract from JWT claims
  const body = validate(schema, parseBody(event)); // Zod validation
  // GSI3 lookup: email → userId (every authenticated route does this)
  const { items } = await queryGSI('GSI3', 'GSI3PK', email, 'USER#');
  const userId = (items[0].GSI3SK as string).replace('USER#', '');
  // ... business logic ...
  return { statusCode: 200, body: { data: result } };
});
```

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

### ID Generation

Uses ULID (`generateId()` in `shared/utils/id.ts`) — time-sortable, conflict-free.

### Secrets

Lazy-loaded singleton with 5-minute TTL cache (`shared/services/secrets.ts`). Pulls from AWS Secrets Manager (`rivalscan/api-keys`): `PADDLE_SECRET_KEY`, `PADDLE_WEBHOOK_SECRET`, `FIRECRAWL_API_KEY`, `ANTHROPIC_API_KEY`.

### AI Models & Anthropic call patterns

All Anthropic calls go through `callAnthropic()` in `shared/services/anthropic.ts` — a thin `fetch` wrapper that retries on 429 with backoff (honors `retry-after` header, default 65s, max 2 retries). Use it for any new Claude call you add; do not call `fetch('.../v1/messages')` directly.

- **Claude Sonnet 4.5** (alias `claude-sonnet-4-5`):
  - `deepResearch()` — research with native `web_search_20250305` tool, max 8 uses/run, max_tokens 4096
  - `detectResearchDeltas()` — compares prior vs current `ResearchFinding`, max_tokens **16384** (large because it generates detailed deltas + impact analysis). Has a `parseDeltasJson()` helper that does **partial JSON recovery** if Claude truncates mid-array — salvages every complete delta object before the cut-off rather than discarding the whole response.
  - `generateWeeklySummary()` — strategic briefing prose for the digest email
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`):
  - `scoreCompetitorThreat()` — 1-2 sentence threat rationale + level (~$0.002/call)
  - `analyzeChange()` (legacy, unused after the deep-research refactor — kept for reference)

**Do not pin Sonnet to a dated snapshot without confirming it exists.** A bad snapshot ID (`claude-sonnet-4-5-20241022`, which is actually a 3.5 Sonnet date) shipped once and caused silent 404s. The alias `claude-sonnet-4-5` is the safe default.

### AI Deep Research (web_search tool)

`deepResearch()` uses Anthropic's `web_search_20250305` **server tool** — Claude manages the search loop internally, no client-side tool-use loop is needed. Single `fetch` call returns `content[]` with a mix of `text`, `server_tool_use`, and `web_search_tool_result` blocks; citations come from `web_search_tool_result`, the structured JSON answer from the final text block. The prompt asks for findings in 5 categories (`news`/`product`/`funding`/`hiring`/`social`) plus a `derivedState` summary block (`stage`, `fundingState`, `hiringState`, `strategicDirection`, `techPositioning`, `pacing`, `evidenceNotes`) and per-finding `sentiment` + `timeSensitivity` metadata.

Triggered automatically on onboarding (in `users/onboard.ts`) to populate day-1 data, and manually via `POST /competitors/{id}/research`. Each run writes one `ResearchFinding` to DynamoDB plus a `Change` record per detected delta. Cost: ~$0.30/run end-to-end.

### Per-competitor enrichment (momentum / threat / tags)

After every research run, `deep-research.ts` runs a post-research enrichment block that writes computed signals back to the **Competitor** record in a single `updateItem` call:

- **`momentum`** (rule-based, free) — `'rising' | 'stable' | 'slowing' | 'declining' | 'insufficient-data'` + `momentumChangePercent`. Computed by `computeMomentum()` in `shared/utils/competitor-metrics.ts` from a 30-day Change-count series; bucket thresholds at +25% / -15% / -40%; `insufficient-data` if total changes in 14d < 3.
- **`threatLevel`** (Haiku) — `'critical' | 'high' | 'medium' | 'low' | 'monitor'` + `threatReasoning` (1-2 sentence rationale). Computed by `scoreCompetitorThreat()`; reads user company context, latest finding's `derivedState`, recent significant changes, and momentum.
- **`derivedTags`** (rule-based, free) — array of up to 6 slug-style tags (e.g. `growth-stage`, `just-raised`, `hiring-aggressively`, `ai-native`, `going-upmarket`). Computed by `deriveTagsFromState()` with priority-ordered rules (concerns > funding events > stage > hiring > strategy > tech > pacing > deprioritize). Frontend `CompetitorTagChips` maps slugs to display labels + tones via a `TAG_CONFIG` dictionary.

The enrichment block is wrapped in try/catch — Haiku failures don't break momentum/tags writes. Sidebar list sort order is **threat desc → momentum desc → name asc** (see `Frontend/src/components/layout/dashboard-sidebar.tsx`).

### Step Functions concurrency

`MapResearch` in `pipeline.stack.ts` uses **`maxConcurrency: 1`** to serialize per-minute Anthropic token usage and avoid rate-limit pile-ups during multi-competitor onboarding. Each research run can burn 10-20k input tokens across 2-3 Sonnet calls; running 3 in parallel reliably trips the 30k input-tokens-per-minute org limit. If you change this back to >1, re-test multi-competitor onboarding.

## DynamoDB Single-Table Design

| Entity | PK | SK |
|--------|----|----|
| User | `USER#<id>` | `PROFILE` |
| Subscription | `USER#<id>` | `SUB` |
| Competitor | `USER#<id>` | `COMP#<id>` |
| Change | `COMP#<id>` | `CHANGE#<timestamp>` |
| ResearchFinding | `COMP#<id>` | `RESEARCH#<timestamp>` |

The `Snapshot` entity from the original Firecrawl pipeline is no longer written. Old snapshot rows from before the deep-research refactor still exist (and the SK prefix `SNAP#` is reserved) but no code path reads them today.

**GSIs**:
- **GSI1** — user's combined feed; stores both `CHANGE#<ts>` and `RESEARCH#<ts>` SK prefixes (filter with `begins_with`)
- **GSI2** — all active competitors (PK=`ACTIVE`); originally for the daily cron, still used by Step Function input collectors
- **GSI3** — user by email (PK=email lowercased) — used by every authenticated route to translate `email` claim → `userId`

The **Competitor** record carries derived intelligence written by the enrichment block: `momentum`, `momentumChangePercent`, `momentumAsOf`, `threatLevel`, `threatReasoning`, `threatAsOf`, `derivedTags`, `derivedTagsAsOf`. These are read directly by the list endpoint without recomputation.

Key builders in `shared/db/keys.ts`. Query helpers (`getItem`, `putItem`, `queryByPK`, `queryGSI`, `updateItem`) in `shared/db/queries.ts`. Pure-function metrics (`computeMomentum`, `buildChangesByDay`, `deriveTagsFromState`) live in `shared/utils/competitor-metrics.ts`.

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

**Weekly digest** (`Backend/src/functions/scheduled/`):
1. `get-subscribers` → 2. `aggregate-changes` (top 10 by significance, past 7 days via GSI1) → 3. `generate-summary` (Claude Sonnet) → 4. `render-send-email` (SES)

**Trigger entry points**:
- Onboarding completion (`api/users/onboard.ts`) starts the ResearchPipeline with all newly-created competitors
- Manual "Research Now" button (`api/competitors/research.ts`, route `POST /competitors/{id}/research`) starts it for a single competitor
- No EventBridge schedule for research — it's strictly on-demand

## Pricing Tiers & Plan Limits

| Tier | Price | Max Competitors | History |
|------|-------|-----------------|---------|
| Scout | $49/mo | 3 | 30 days |
| Strategist | $99/mo | 10 | 90 days |
| Command | $199/mo | 25 | 1 year |

Defined in `PLAN_LIMITS` from `shared/types/index.ts`. Enforced in `competitors/create.ts`. Payments handled via Paddle (checkout sessions, customer portal, webhook lifecycle events).

## Environment Variables

**Backend Lambda** (set via CDK): `TABLE_NAME`, `BUCKET_NAME`, `USER_POOL_ID`, `USER_POOL_CLIENT_ID`, `SECRETS_ARN`, `FRONTEND_URL`, `FROM_EMAIL`. Lambdas that trigger the research state machine (`api/users/onboard.ts`, `api/competitors/research.ts`) get `RESEARCH_PIPELINE_ARN`. Subscription checkout gets `PADDLE_PRICE_SCOUT`/`_STRATEGIST`/`_COMMAND`. (`DAILY_PIPELINE_ARN` is gone with the daily scrape pipeline.)

**CDK deploy** (required for `cdk deploy`): `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION` (defaults to us-east-1), `FRONTEND_URL` (for API CORS — **must match the Amplify URL exactly**, e.g. `https://main.d1zrq9gf129s9u.amplifyapp.com`, or CORS blocks the browser), `FROM_EMAIL`, `PADDLE_PRICE_*`. `bin/app.ts` validates `CDK_DEFAULT_ACCOUNT` and `FRONTEND_URL` at synth time. A populated `Backend/.env` can be sourced with `set -a && source .env && set +a`.

**Frontend** (Amplify app-level env vars): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`. **These are inlined at build time**, not read at runtime — after changing them in Amplify console you MUST trigger a rebuild (`aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE`), otherwise the old localhost-fallback bundle keeps serving.

## Deploy Notes

- **Backend** deploys via `cdk deploy --all` from `Backend/` after sourcing `.env`. Individual stacks: `cdk deploy RivalScan-dev-Pipeline RivalScan-dev-Api`.
- **Frontend** deploys automatically on push to `main` (Amplify tracks the GitHub repo). Manual: `aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE`.
- AWS region is **us-east-1**. Paths with leading `/` (CloudWatch log group names, IAM ARNs) passed to `aws` CLI from Git Bash on Windows get mangled — prefix with `MSYS_NO_PATHCONV=1`.
