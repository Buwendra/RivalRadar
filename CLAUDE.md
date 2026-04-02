# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RivalScan is an AI-powered competitive intelligence monitoring SaaS for SMBs. It scrapes competitor websites daily, uses Claude AI to analyze changes and their strategic implications, and delivers weekly strategic briefings via email. Priced at $49–$199/month to fill the gap between free tools (Google Alerts) and $20K+/year enterprise platforms (Crayon, Klue).

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui, deployed to Vercel (standalone output mode)
- **Backend**: AWS CDK (TypeScript) — fully serverless
  - API Gateway HTTP API v2 + Lambda (Node.js 20)
  - DynamoDB (single-table, on-demand) + S3 (snapshots)
  - Step Functions (daily scraping pipeline + weekly digest)
  - EventBridge Scheduler (cron triggers)
  - Cognito (auth) + SES (email) + Secrets Manager
  - CloudFront + WAF + CloudWatch + X-Ray
- **External Services**: Firecrawl API (scraping), Anthropic Claude API (analysis), Paddle (payments)

## Architecture

```
Next.js (Vercel) → CloudFront/WAF → API Gateway v2 → Cognito JWT → Lambda → DynamoDB/S3

EventBridge (daily 6am) → Step Functions → [Scrape → Store → Diff → Analyze → Alert]
EventBridge (Mon 8am)   → Step Functions → [Aggregate → Sonnet Summary → SES Email]
```

**7 CDK stacks** wired in `bin/app.ts` with explicit cross-stack dependencies:
Database → Storage → Auth → Email → Pipeline → API (receives pipeline ARN) → Monitoring.
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

### Frontend Global Query Config

`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false` (set in `lib/providers/app-providers.tsx`).

### Auth Flow

Cognito JWT → tokens in localStorage → `AuthProvider` hydrates on mount, checks token expiry every 60s → `AuthGuard` component wraps protected routes and enforces onboarding completion.

### ID Generation

Uses ULID (`generateId()` in `shared/utils/id.ts`) — time-sortable, conflict-free.

### Secrets

Lazy-loaded singleton with 5-minute TTL cache (`shared/services/secrets.ts`). Pulls from AWS Secrets Manager (`rivalscan/api-keys`): `PADDLE_SECRET_KEY`, `PADDLE_WEBHOOK_SECRET`, `FIRECRAWL_API_KEY`, `ANTHROPIC_API_KEY`.

### AI Models

- **Claude Haiku 4.5**: Real-time change analysis (fast, cost-effective) — called in `analyze-change.ts`
- **Claude Sonnet 4.5**: Weekly strategic summaries — called in `generate-summary.ts`
- Uses native Anthropic API via `fetch` (not SDK)

## DynamoDB Single-Table Design

| Entity | PK | SK |
|--------|----|----|
| User | `USER#<id>` | `PROFILE` |
| Subscription | `USER#<id>` | `SUB` |
| Competitor | `USER#<id>` | `COMP#<id>` |
| Change | `COMP#<id>` | `CHANGE#<timestamp>` |
| Snapshot | `COMP#<id>` | `SNAP#<pageHash>#<ts>` |

**GSIs**: GSI1 (user's changes feed by timestamp), GSI2 (all active competitors for daily cron — PK=`ACTIVE`), GSI3 (user by email for auth lookups)

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

## Pricing Tiers & Plan Limits

| Tier | Price | Max Competitors | History |
|------|-------|-----------------|---------|
| Scout | $49/mo | 3 | 30 days |
| Strategist | $99/mo | 10 | 90 days |
| Command | $199/mo | 25 | 1 year |

Defined in `PLAN_LIMITS` from `shared/types/index.ts`. Enforced in `competitors/create.ts`. Payments handled via Paddle (checkout sessions, customer portal, webhook lifecycle events).

## Environment Variables

**Backend Lambda** (set via CDK): `TABLE_NAME`, `BUCKET_NAME`, `USER_POOL_ID`, `USER_POOL_CLIENT_ID`, `SECRETS_ARN`, `FRONTEND_URL`, `FROM_EMAIL`

**CDK deploy**: `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION` (defaults to us-east-1), `FRONTEND_URL` (for CORS, defaults to `http://localhost:3000`)

**Frontend**: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`
