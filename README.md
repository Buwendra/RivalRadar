# RivalScan

AI-powered competitive intelligence + brand monitoring for SMBs. Claude-powered deep web research on each competitor (and on your own brand), strategic delta detection, threat scoring, and weekly briefings delivered via email + Slack + webhook.

Priced at $49–$199/month to fill the gap between free tools (Google Alerts) and $20k+/year enterprise platforms (Crayon, Klue).

> **Naming**: the git repo / directory is `RivalRadar`, the product is `RivalScan`. Code identifiers (stack names, secret paths, UI copy) all use `RivalScan`.

## Tech stack

- **Frontend** — Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui, deployed via AWS Amplify
- **Backend** — AWS CDK (TypeScript): API Gateway HTTP API v2 + Lambda (Node 20, ARM64) + DynamoDB (single-table) + Step Functions + EventBridge + Cognito + SES + Secrets Manager
- **AI** — Anthropic Claude (Sonnet 4.5 for research/summaries, Haiku 4.5 for threat scoring + classification)
- **Payments** — Paddle (merchant of record)

## Quick start

```bash
# Backend
cd Backend
npm install
npm run lint          # tsc --noEmit
npx vitest run        # unit tests
# Deploy (requires AWS credentials + .env populated):
set -a && source .env && set +a
npx cdk deploy --all

# Frontend
cd ../Frontend
npm install
npm run dev           # http://localhost:3000
```

## Find your way around

- **Working in the code?** → [CLAUDE.md](CLAUDE.md) is the reference. Conventions, architecture, patterns, deploy notes.
- **Want the product narrative?** → [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md).
- **Looking for everything else** (roadmaps, runbooks, security docs, API reference, internal analyses) → [docs/README.md](docs/README.md).

## Repo layout

```
/
├── README.md                  ← you are here
├── CLAUDE.md                  ← architecture + conventions reference
├── PRODUCT_OVERVIEW.md        ← public-safe product narrative
├── Backend/                   ← AWS CDK + Lambda source
├── Frontend/                  ← Next.js app
└── docs/                      ← roadmaps, runbooks, security, API, internal
```
