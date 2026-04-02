# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RivalScan is an AI-powered competitive intelligence monitoring SaaS for SMBs. It scrapes competitor websites daily, uses Claude AI to analyze changes and their strategic implications, and delivers weekly strategic briefings via email. Priced at $49–$199/month to fill the gap between free tools (Google Alerts) and $20K+/year enterprise platforms (Crayon, Klue).

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (Vercel)
- **Backend**: AWS CDK (TypeScript) — fully serverless
  - API Gateway HTTP API v2 + Lambda (Node.js 20)
  - DynamoDB (single-table, on-demand) + S3 (snapshots)
  - Step Functions (daily scraping pipeline + weekly digest)
  - EventBridge Scheduler (cron triggers)
  - Cognito (auth) + SES (email) + Secrets Manager
  - CloudFront + WAF + CloudWatch + X-Ray
- **External Services**: Firecrawl API (scraping), Anthropic Claude API (analysis), Stripe (payments)

## Architecture

```
Next.js (Vercel) → CloudFront/WAF → API Gateway v2 → Cognito JWT → Lambda → DynamoDB/S3

EventBridge (daily 6am) → Step Functions → [Scrape → Store → Diff → Analyze → Alert]
EventBridge (Mon 8am)   → Step Functions → [Aggregate → Sonnet Summary → SES Email]
```

## Backend Structure (`Backend/`)

```
Backend/
├── bin/app.ts                      # CDK app entry — 7 stacks
├── lib/stacks/                     # CDK infrastructure
│   ├── database.stack.ts           # DynamoDB (single table + 3 GSIs)
│   ├── storage.stack.ts            # S3 bucket (snapshots)
│   ├── auth.stack.ts               # Cognito User Pool
│   ├── api.stack.ts                # API Gateway + all Lambda routes
│   ├── pipeline.stack.ts           # Step Functions + EventBridge crons
│   ├── email.stack.ts              # SES config
│   └── monitoring.stack.ts         # CloudWatch dashboards + alarms
├── src/
│   ├── functions/
│   │   ├── api/                    # API Lambda handlers
│   │   │   ├── auth/               # signup, signin (public)
│   │   │   ├── users/              # profile, onboard
│   │   │   ├── competitors/        # CRUD + manual scrape trigger
│   │   │   ├── changes/            # list (paginated), get, feedback
│   │   │   ├── subscriptions/      # current, checkout, portal
│   │   │   └── webhooks/           # Stripe webhook
│   │   ├── pipeline/               # Step Function Lambdas (daily)
│   │   └── scheduled/              # Step Function Lambdas (weekly digest)
│   └── shared/
│       ├── db/                     # DynamoDB client, key builders, queries
│       ├── services/               # Firecrawl, Anthropic, Stripe, SES, Secrets
│       ├── types/                  # TypeScript interfaces
│       ├── middleware/             # Handler wrapper (CORS, errors, validation)
│       └── utils/                  # Logger, diff, ID generation
└── test/
```

## DynamoDB Single-Table Design

| Entity | PK | SK |
|--------|----|----|
| User | `USER#<id>` | `PROFILE` |
| Subscription | `USER#<id>` | `SUB` |
| Competitor | `USER#<id>` | `COMP#<id>` |
| Change | `COMP#<id>` | `CHANGE#<timestamp>` |
| Snapshot | `COMP#<id>` | `SNAP#<pageHash>#<ts>` |

**GSIs**: GSI1 (user's changes feed), GSI2 (active competitors for cron), GSI3 (user by email)

Snapshot markdown content stored in S3, referenced by `s3Key` in DynamoDB.

## Backend Commands

```bash
cd Backend
npm install              # Install dependencies
npx tsc --noEmit         # Type-check
npx cdk synth            # Generate CloudFormation
npx cdk deploy --all     # Deploy all stacks
npx cdk diff             # Preview changes
npx vitest               # Run tests
npx vitest --watch       # Tests in watch mode
```

## Pricing Tiers & Plan Limits

| Tier | Price | Max Competitors | History |
|------|-------|-----------------|---------|
| Scout | $49/mo | 3 | 30 days |
| Strategist | $99/mo | 10 | 90 days |
| Command | $199/mo | 25 | 1 year |

Plan limits enforced in `competitors/create.ts` via `PLAN_LIMITS` from `shared/types/index.ts`.

## Key Design Decisions

- **DynamoDB single-table** with 3 GSIs — fully serverless, pay-per-request
- **Step Functions** orchestrate scraping pipeline — parallel fan-out per competitor, built-in retries
- **Cognito JWT authorizer** on API Gateway — auth validated before Lambda runs
- **S3 for snapshot content** — keeps DynamoDB items under 400KB limit
- **Firecrawl** handles anti-bot/JS rendering, returns clean Markdown for AI analysis
- **Significance scoring** (1-10) — only ≥ 7 triggers real-time email alerts
- **Cursor-based pagination** using DynamoDB `LastEvaluatedKey` encoded as opaque base64 token
- **Consistent API envelope**: `{ data, error, meta: { cursor, hasMore } }`
- **Zod validation** at Lambda handler level with field-level error details

## Frontend Structure (`Frontend/`)

```
Frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root: fonts, AppProviders, metadata
│   │   ├── not-found.tsx / error.tsx
│   │   ├── (public)/               # Landing page + pricing (server components)
│   │   ├── (auth)/                 # Sign-in/sign-up (centered layout)
│   │   ├── onboarding/             # 3-step wizard
│   │   └── (dashboard)/            # Protected app (AuthGuard + sidebar shell)
│   │       └── dashboard/          # Feed, competitors/[id], changes/[id], settings
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── layout/                 # Navbar, footer, sidebar, header, auth-guard
│   │   ├── landing/                # Hero, problem, how-it-works, features, pricing, FAQ, CTA
│   │   ├── dashboard/              # Change feed/card/filters, significance/type badges, stats
│   │   ├── onboarding/             # 3-step wizard components
│   │   ├── settings/               # Profile, subscription, plan upgrade
│   │   └── shared/                 # Logo, spinner, page-header, error-alert, confirm-dialog
│   └── lib/
│       ├── api/                    # Fetch wrapper + domain modules (auth, users, competitors, changes, subscriptions)
│       ├── auth/                   # Context, provider, token storage, useAuth hook
│       ├── hooks/                  # TanStack Query hooks for all data domains
│       ├── types/                  # Mirrored from backend types
│       ├── utils/                  # cn, constants, format-date, significance, plan-limits
│       └── providers/              # AppProviders (QueryClient + Auth + Toaster)
```

### Frontend Design System

- **Color palette**: Navy 950 (#0A0F1E) backgrounds, Blue 500 (#3B82F6) primary, Amber 500 (#F59E0B) CTAs
- **Significance colors**: Emerald (1-3 Low), Yellow (4-6 Medium), Red (7-10 High)
- **Auth**: Cognito JWT tokens in localStorage, AuthGuard client component
- **Data fetching**: TanStack Query v5 with cursor-based infinite scroll for changes
- **Forms**: React Hook Form + Zod validation
- **Components**: shadcn/ui

### Frontend Commands

```bash
cd Frontend
npm install              # Install dependencies
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
```

### Frontend Environment Variables

```env
NEXT_PUBLIC_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com
```

## Environment Setup

External API keys stored in AWS Secrets Manager under `rivalscan/api-keys`:
- `FIRECRAWL_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

Set `FRONTEND_URL` env var for CORS (defaults to `http://localhost:3000`).
