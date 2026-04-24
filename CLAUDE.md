# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RivalScan is an AI-powered competitive intelligence monitoring SaaS for SMBs. It scrapes competitor websites daily, uses Claude AI to analyze changes and their strategic implications, and delivers weekly strategic briefings via email. Priced at $49–$199/month to fill the gap between free tools (Google Alerts) and $20K+/year enterprise platforms (Crayon, Klue).

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui, deployed to **AWS Amplify** (standalone output mode). App ID `d1zrq9gf129s9u`; root dir `Frontend/`.
- **Backend**: AWS CDK (TypeScript) — fully serverless
  - API Gateway HTTP API v2 + Lambda (Node.js 20, ARM64)
  - DynamoDB (single-table, on-demand) + S3 (snapshots)
  - Step Functions (3 state machines: daily scrape, weekly digest, deep research)
  - EventBridge Scheduler (cron triggers for daily + weekly)
  - Cognito (auth) + SES (email) + Secrets Manager
  - CloudFront + WAF + CloudWatch + X-Ray
- **External Services**: Firecrawl API (scraping), Anthropic Claude API (analysis + web_search agentic research), Paddle (payments)

## Architecture

```
Next.js (Amplify SSR) → API Gateway v2 → Cognito JWT → Lambda → DynamoDB/S3

EventBridge (daily 6am) → DailyPipeline SFN   → [Scrape → Store → Diff → Analyze → Alert]
EventBridge (Mon 8am)   → WeeklyDigest SFN    → [Aggregate → Sonnet Summary → SES Email]
Onboard / manual        → ResearchPipeline SFN → [DeepResearch via Claude web_search]
```

**7 CDK stacks** wired in `bin/app.ts` with explicit cross-stack dependencies:
Database → Storage → Auth → Email → Pipeline → API (receives daily + research ARNs) → Monitoring.
Stack naming: `RivalScan-${stage}-${StackType}` (stage from env context: dev/staging/prod).

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

### AI Models

- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`): Per-change analysis — `analyze-change.ts`
- **Claude Sonnet 4.5** (alias `claude-sonnet-4-5`): Weekly digest summaries (`generate-summary.ts`) AND deep research (`deep-research.ts`)
- Uses native Anthropic API via `fetch` (not SDK). Model IDs are constants at the top of `shared/services/anthropic.ts`.
- **Do not pin Sonnet to a dated snapshot without confirming it exists** — historically a bad snapshot ID (`claude-sonnet-4-5-20241022`, which is actually a 3.5 Sonnet date) shipped to prod and caused silent 404s in weekly digest + deep research. Use the alias unless you've verified the dated snapshot.

### AI Deep Research (web_search tool)

`deepResearch()` in `shared/services/anthropic.ts` uses Anthropic's native `web_search_20250305` **server tool** (max 8 uses per run) — Claude manages the search loop internally, no client-side tool-use loop is needed. Single `fetch` call returns `content[]` with a mix of `text`, `server_tool_use`, and `web_search_tool_result` blocks; citations are extracted from the latter, JSON findings from the final text block.

Triggered automatically on onboarding (in `users/onboard.ts`) to populate new accounts with day-1 data, and manually via `POST /competitors/{id}/research`. Each run writes one `ResearchFinding` to DynamoDB. Cost: ~$0.15-0.30/run.

## DynamoDB Single-Table Design

| Entity | PK | SK |
|--------|----|----|
| User | `USER#<id>` | `PROFILE` |
| Subscription | `USER#<id>` | `SUB` |
| Competitor | `USER#<id>` | `COMP#<id>` |
| Change | `COMP#<id>` | `CHANGE#<timestamp>` |
| Snapshot | `COMP#<id>` | `SNAP#<pageHash>#<ts>` |
| ResearchFinding | `COMP#<id>` | `RESEARCH#<timestamp>` |

**GSIs**: GSI1 (user's feed — stores both `CHANGE#<ts>` and `RESEARCH#<ts>` SK prefixes; filter with `begins_with`), GSI2 (all active competitors for daily cron — PK=`ACTIVE`), GSI3 (user by email for auth lookups)

Snapshot markdown content stored in S3, referenced by `s3Key` in DynamoDB.

Key builders in `shared/db/keys.ts`. Query helpers (`getItem`, `putItem`, `queryByPK`, `queryGSI`, `updateItem`) in `shared/db/queries.ts`.

## Pipeline Flow (Step Functions)

**Daily pipeline** (`src/functions/pipeline/`):
1. `get-competitors` — queries GSI2 for all active competitors (handles manual/onboarding triggers too)
2. `scrape-pages` — Firecrawl scrape per tracked page, graceful failure per page
3. `store-snapshots` — saves markdown to S3
4. `detect-diffs` — line-based diff via `shared/utils/diff.ts`, filters to changed pages only
5. `analyze-change` — Claude Haiku produces structured `AiAnalysis` JSON
6. `store-change` — writes to DynamoDB (primary table + GSI1 for user feed)
7. `send-alert` — emails user for high-significance changes (≥ 7)

**Weekly digest** (`src/functions/scheduled/`):
1. `get-subscribers` → 2. `aggregate-changes` (top 10 by significance, past 7 days via GSI1) → 3. `generate-summary` (Claude Sonnet) → 4. `render-send-email` (SES)

**Research pipeline** (`src/functions/pipeline/deep-research.ts` — single Lambda, mapped over competitors with concurrency 5):
1. `onboard.ts` or `competitors/research.ts` starts the ResearchPipeline SFN with `{ competitors: [{ competitorId, userId, name, url, industry? }] }`
2. SFN Map invokes `deep-research` per competitor — calls Claude Sonnet + web_search, writes a `ResearchFinding` to DynamoDB
3. Failures are caught per-item (does not fail the whole execution). Lambda timeout 5 min, memory 1024 MB (web_search responses can be large)

## Pricing Tiers & Plan Limits

| Tier | Price | Max Competitors | History |
|------|-------|-----------------|---------|
| Scout | $49/mo | 3 | 30 days |
| Strategist | $99/mo | 10 | 90 days |
| Command | $199/mo | 25 | 1 year |

Defined in `PLAN_LIMITS` from `shared/types/index.ts`. Enforced in `competitors/create.ts`. Payments handled via Paddle (checkout sessions, customer portal, webhook lifecycle events).

## Environment Variables

**Backend Lambda** (set via CDK): `TABLE_NAME`, `BUCKET_NAME`, `USER_POOL_ID`, `USER_POOL_CLIENT_ID`, `SECRETS_ARN`, `FRONTEND_URL`, `FROM_EMAIL`. Lambdas that trigger state machines also get `DAILY_PIPELINE_ARN` (onboard, scrape) and/or `RESEARCH_PIPELINE_ARN` (onboard, research). Subscription checkout gets `PADDLE_PRICE_SCOUT`/`_STRATEGIST`/`_COMMAND`.

**CDK deploy** (required for `cdk deploy`): `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION` (defaults to us-east-1), `FRONTEND_URL` (for API CORS — **must match the Amplify URL exactly**, e.g. `https://main.d1zrq9gf129s9u.amplifyapp.com`, or CORS blocks the browser), `FROM_EMAIL`, `PADDLE_PRICE_*`. `bin/app.ts` validates `CDK_DEFAULT_ACCOUNT` and `FRONTEND_URL` at synth time. A populated `Backend/.env` can be sourced with `set -a && source .env && set +a`.

**Frontend** (Amplify app-level env vars): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`. **These are inlined at build time**, not read at runtime — after changing them in Amplify console you MUST trigger a rebuild (`aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE`), otherwise the old localhost-fallback bundle keeps serving.

## Deploy Notes

- **Backend** deploys via `cdk deploy --all` from `Backend/` after sourcing `.env`. Individual stacks: `cdk deploy RivalScan-dev-Pipeline RivalScan-dev-Api`.
- **Frontend** deploys automatically on push to `main` (Amplify tracks the GitHub repo). Manual: `aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE`.
- AWS region is **us-east-1**. Paths with leading `/` (CloudWatch log group names, IAM ARNs) passed to `aws` CLI from Git Bash on Windows get mangled — prefix with `MSYS_NO_PATHCONV=1`.
