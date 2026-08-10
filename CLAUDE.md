# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kironyx is an AI-powered competitive-intelligence + brand-monitoring SaaS for SMBs, positioned as "competitive self-awareness". It runs Claude-powered deep web research on each competitor **and on the customer's own brand** (Brand Pulse, `targetKind: 'self'`), benchmarks them side by side, detects strategically significant changes, scores their implications, and delivers weekly strategic + comparative briefings via email. Priced at $49–$199/month to fill the gap between free tools (Google Alerts) and $20K+/year enterprise platforms (Crayon, Klue).

**Naming**: the git repo / directory is `RivalRadar`, but the product and all code identifiers (stack names, secret paths, UI copy) use **`Kironyx`** — they refer to the same thing. Use `Kironyx` in code. (The product was called **RivalScan** until July 2026 — commits, git history, and the old AWS `RivalScan-*` stacks predate the rebrand.)

> The product no longer scrapes sites on a daily cron. The original Firecrawl daily-snapshot pipeline was replaced by on-demand + scheduled Claude deep research (see "AI Deep Research"); there is no daily scrape Lambda anymore.

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
Stack naming: `Kironyx-${stage}-${StackType}` (stage from env context: dev/staging/prod).

**Backend layout split**: CDK stack definitions live in `Backend/lib/stacks/*.stack.ts` (infrastructure); Lambda handler source lives in `Backend/src/functions/` (`api/` per-route handler modules, `routers/` the domain-function entry points that dispatch to them, `pipeline/` and `scheduled/` for the state-machine/cron Lambdas) with cross-cutting code in `Backend/src/shared/`. References to `api.stack.ts`, `pipeline.stack.ts`, etc. throughout this doc mean files under `lib/stacks/`.

**API packaging (domain functions)**: the Api stack deploys ~20 **domain-grouped Lambda functions**, not one per route — CloudFormation caps a stack at 500 resources (hard limit; the old per-route layout synthesized 588 and could not deploy). `Backend/src/functions/route-manifest.ts` is the single source of truth: 84 routes mapped to 20 functions **grouped by privilege + packaging, not URL path** (elevated IAM stays on dedicated functions — `UserDelete`, `ResearchTriggers`, `ResearchRunsDetails`; PDF bundling isolates in `Pdf`; kill-switch routes stay solo — `AuthSignup`, `AuthRefresh`, `PaddleWebhook`). Each function's entry is a thin router in `src/functions/routers/` dispatching on the **exact `event.routeKey`** (never parse paths) and passing the raw event/result through untouched. **Adding a route = one manifest row + one entry in the owning router's table** — two tests enforce agreement (`routers/router-manifest.test.ts` and the template test `lib/stacks/api.stack.test.ts`, both in CI). Handler modules under `api/` are unchanged by this layer and stay individually testable.

The current product roadmap and design rationale lives in [docs/roadmaps/ROADMAP.md](docs/roadmaps/ROADMAP.md), [docs/roadmaps/PRODUCT_GAPS_ROADMAP.md](docs/roadmaps/PRODUCT_GAPS_ROADMAP.md), [docs/roadmaps/COMPLIANCE_ROADMAP.md](docs/roadmaps/COMPLIANCE_ROADMAP.md), and [docs/roadmaps/PREDICTIONS_AND_TAGS.md](docs/roadmaps/PREDICTIONS_AND_TAGS.md). Treat those as the source of truth for what's shipped vs. what's planned. The full doc index lives at [docs/README.md](docs/README.md).

## Documentation map

| Where | Purpose |
|---|---|
| `/CLAUDE.md` (this file) | Architecture + conventions reference for Claude Code |
| `/README.md` | Top-level project orientation |
| `/PRODUCT_OVERVIEW.md` | Public-safe product narrative |
| `/PLAN.md` | July 2026 repositioning plan (competitor-analysis → bidirectional "cross-check" framing) — surface-by-surface copy/IA changes with hard guardrails (no `PLAN_LIMITS`/`CAPABILITIES` value changes, AI disclaimers preserved) |
| `/REPOSITIONING_SUMMARY.md` | Before/after record of what that repositioning actually changed, per surface |
| `/docs/README.md` | Documentation index |
| `/docs/roadmaps/` | What's planned + what's shipped (with status badges) |
| `/docs/runbooks/` | How to operate the system — deploy, test, page response, secret rotation |
| `/docs/security/` | Security posture, audit material, vendor risk register, change management |
| `/docs/api/` | Public API reference |
| `/docs/internal/` | Material intentionally not public (pricing-value analysis, business scope) |
| `/docs/demo/`, `/docs/examples/` | Sample competitive-intelligence reports used for demos |
| `/docs/LAUNCH_ISSUES.md` | Numbered launch-blocking issues (1–11+) with per-issue fix plans; recent commits reference these by number (e.g. "Issue 7/8/9") |
| `/Frontend/README.md` | Frontend dev guide |
| `/Presentation/index.html` | Standalone single-file HTML demo deck (Tailwind CDN) — not part of any build or CI |

Spelling is a per-file convention: frontend copy + internal docs use US English; `PRODUCT_OVERVIEW.md` and customer-facing docs use UK English. Match the file you're editing.

## Master phase timeline

The three roadmap docs each use their own phase numbering (ROADMAP.md 0–5, PRODUCT_GAPS_ROADMAP.md 1–11, COMPLIANCE_ROADMAP.md 1–7), but the code references a single master timeline. This table maps every "Phase N" mentioned anywhere in the codebase to its home roadmap.

| # | Phase | Lives in | Status |
|---|---|---|---|
| 0 | Research prompt enrichment | `docs/roadmaps/ROADMAP.md` | ✅ |
| 1 | Pipeline continuity & cost observability | `docs/roadmaps/PRODUCT_GAPS_ROADMAP.md` | ✅ |
| 1 (compliance) | Misuse defense + AI safety | `docs/roadmaps/COMPLIANCE_ROADMAP.md` | ✅ |
| 2 | Momentum / Recommendations | `docs/roadmaps/{ROADMAP,PRODUCT_GAPS_ROADMAP}.md` | ✅ |
| 3 | Threat level / Multi-channel delivery | `docs/roadmaps/{ROADMAP,PRODUCT_GAPS_ROADMAP}.md` | ✅ |
| 4a/b/c | Workspaces (tenancy / governance / ownership) | `docs/roadmaps/PRODUCT_GAPS_ROADMAP.md` | ✅ |
| 5 | Onboarding & analytics events | `docs/roadmaps/PRODUCT_GAPS_ROADMAP.md` | ✅ |
| 6 / 6a / 6b / 6c | Capability matrix / custom rec categories / PDF exports / scheduled reports | `docs/roadmaps/PRODUCT_GAPS_ROADMAP.md` | ✅ |
| 7a / 7b | Change notes / Saved views | `docs/roadmaps/PRODUCT_GAPS_ROADMAP.md` | ✅ |
| 8a / 8b / 8c | Retention nudges / Cancellation feedback / Status page | `docs/roadmaps/PRODUCT_GAPS_ROADMAP.md` | ✅ |
| 9 | Security hardening (final wave) | `docs/roadmaps/PRODUCT_GAPS_ROADMAP.md` | 🚧 ~80% |
| 10 | Trust & certifications | `docs/roadmaps/PRODUCT_GAPS_ROADMAP.md` | 💤 |
| 11 | Public API | (in-code: API key entity + `/v1/*` routes) | ✅ |
| 13 | API key scopes | (in-code: scope field on ApiKey) | ✅ |
| 14 | Three-role workspace hierarchy | (in-code: owner / admin / member) | ✅ |
| 15 | Saved-view subscriptions | (in-code: SavedViewSubscription entity) | ✅ |
| 18 | In-app notifications | (in-code: Notification entity) | ✅ |
| 19 / 20 / 21 | Comparator matrix / Battlecards / Win-against tactics | (in-code) | ✅ |
| 22 | Research-run observability | (in-code: ResearchRun entity) | ✅ |
| 23 | Brand Pulse (self-brand monitoring) | (in-code) | ✅ |
| 24 | Comparative analytics (SoV / Brand Health / Comparative Briefing) | (in-code) | ✅ |
| Phase 11 — Go Live | Parking lot for launch-gated items | `docs/roadmaps/PRODUCT_GAPS_ROADMAP.md` | 🚧 |
| Demo-wow Phases 1–3 | Since-last-looked / Audio briefing / Live polling + time-machine | (in-code) | ✅ |

Numbering caveat: the in-code phases (11+) were assigned ad-hoc during sprints and don't correspond 1:1 to PRODUCT_GAPS_ROADMAP phases. When in doubt, search the repo for the literal "Phase N" string — every shipped phase is referenced from at least one comment in either `CLAUDE.md` or the source files.

## Commands

### Backend (`Backend/`)

```bash
cd Backend
npm install                          # Install dependencies
npm run lint                         # Type-check (alias for `tsc --noEmit` — NOT ESLint)
npx cdk synth                        # Generate CloudFormation  (alias: npm run synth)
npx cdk deploy --all                 # Deploy all stacks        (alias: npm run deploy)
npx cdk diff                         # Preview changes          (alias: npm run diff)
npx vitest                           # Run all tests            (npm test runs `vitest run` once)
npx vitest --watch                   # Tests in watch mode      (alias: npm run test:watch)
npx vitest src/path/to/file.test.ts  # Run a single test file
```

Heads-up: `npm run lint` on the backend is a **TypeScript type-check** (`tsc --noEmit`), not a linter — there is no ESLint config in `Backend/`. The frontend's `npm run lint` is the real ESLint.

Tests are colocated next to source as `*.test.ts`. `vitest.config.ts` includes both `test/**/*.test.ts` and `src/**/*.test.ts` — if you add tests in a new place, confirm one of those patterns matches.

**`Backend/scripts/`** holds operational/one-off scripts (run with `npx ts-node`, env vars like `TABLE_NAME`/`RESEARCH_PIPELINE_ARN` supplied inline — see each file's `Usage` header): demo + brand + battlecard seeders (`seed-demo-data.ts`, `seed-brand-data.ts`, `seed-battlecards.sh`), research data maintenance (`delete-research.ts`, `trim-research.ts`), and the SOC 2 evidence snapshot (`soc2-evidence-snapshot.sh`). These hit live AWS resources — not part of the test/build loop. One script is local-only (no AWS): `generate-frontend-capabilities.ts` regenerates the frontend capability mirror from the backend source — run it after editing `shared/types/capabilities.ts` and commit both files together (see "Capability Gating").

### Frontend (`Frontend/`)

```bash
cd Frontend
npm install              # Install dependencies
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
```

### CI (GitHub Actions)

Two workflows under `.github/workflows/`, forming the required-status-check baseline for the `main` branch-protection rule:
- **`verify.yml`** — runs on PRs touching `Backend/**` or `Frontend/**` and on push to `main`. Backend job: `tsc --noEmit` + `vitest run`. Frontend job: `tsc --noEmit` + `npm run lint`. Both install with `npm ci --no-audit --ignore-scripts`. **`cdk synth` is intentionally NOT in CI** (too slow/costly) — run it locally before infra changes.
- **`npm-audit.yml`** — `npm audit --audit-level=high --production` for both dirs on dependency-file PRs + a weekly Sunday 6am UTC scan. Fails only on high/critical CVEs.

Match the CI checks locally before pushing (`npm run lint && npx tsc --noEmit && npx vitest run`) — there's no auto-formatter, so a lint failure blocks merge.

### Project Claude Code tooling (`.claude/`)

Three project skills wrap procedures whose steps fail silently when skipped — prefer them over ad-hoc versions of the same work:
- **`/verify`** — runs the CI trio for whichever side changed, plus `cdk synth` for infra changes (CI deliberately excludes synth, so stack definitions have no automated gate).
- **`/add-capability`** — walks the capability-flag change across all three hand-written copies + the generated frontend mirror; value-only tier changes type-check clean while the frontend gates on stale entitlements.
- **`/deploy-preflight`** — pre-`cdk deploy` sequence (env sourcing with `set -a`, stage context, fresh synth, secret existence, diff review). Knows about drift in the deployment runbook and corrects for it.

One subagent: **`kironyx-review`** — reviews a diff against this repo's historical bug classes (self-brand filter discipline, atomic write helpers, `callAnthropic` wrapper usage, DDB key conditions, CORS twins, capability-mirror drift). Run it after backend changes alongside the general `/code-review`.

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

**CORS lives in two places that must not drift**: the per-request `corsHeaders(event)` helper in `shared/middleware/handler.ts` (echoes the caller's origin when it's in the comma-separated `ALLOWED_ORIGINS` env list, primary origin otherwise — `allowCredentials: true` forbids `*`) and the gateway `corsPreflight` in `api.stack.ts` (built from the same `ALLOWED_ORIGINS`). If you add a custom request header (like `X-Workspace-Id` / `X-Api-Key`), update both allow-header lists.

### Backend Path Aliases (tsconfig)

- `@shared/*` → `./src/shared/*`
- `@functions/*` → `./src/functions/*`

### Frontend Path Alias (tsconfig)

- `@/*` → `./src/*`

### API Response Envelope

All API responses follow: `{ data?, error?: { code, message, details? }, meta?: { cursor?, hasMore } }`

### Pagination

Cursor-based using DynamoDB `LastEvaluatedKey` → base64url-encoded JSON string. Clients pass cursor back as query param. Frontend uses TanStack Query `useInfiniteQuery` with `getNextPageParam` reading `meta.cursor`. Malformed/forged cursors throw `InvalidCursorError` from `queries.ts`, which `apiHandler` duck-type-maps to a 400 `INVALID_CURSOR` (not a 500) — DDB `ValidationException` from a tampered cursor is caught too.

**`since` filters must be key conditions, not post-filters.** `queryByPK`/`queryGSI` accept `skBetween`; build the range with `skPrefixRange('CHANGE#', sinceIso)` so it stays inside the SK prefix namespace. Two traps this exists to prevent: `begins_with(SK, 'CHANGE#<full-ISO>')` silently matches nothing, and post-filtering after the DDB `Limit` returns short/empty pages with `hasMore: true`.

### Frontend Data Flow

API calls: `lib/api/client.ts` (`apiClient<T>` / `apiClientWithMeta<T>`) → domain modules (`lib/api/{resource}.ts`) → TanStack Query hooks (`lib/hooks/use-{resource}.ts`) → components.

Auth tokens stored in localStorage with `kx_` prefix. `apiClient` auto-injects Bearer token when `requireAuth: true` (default). On 401 it attempts a token refresh and replays the request once before clearing tokens and redirecting to `/sign-in` (preserving the return path via `?redirect=` — which sign-in only honours for same-origin paths, closing an open redirect).

**Cognito token gotcha**: `apiClient` must send `kx_id_token` (not `kx_access_token`) because the backend's `getUserEmail()` reads the `email` JWT claim, which only appears in Cognito **ID tokens** — access tokens contain only `sub`/`username`. Changing this reintroduces "Missing email claim" 401s on every authenticated route.

### Frontend Global Query Config

`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false` (set in `lib/providers/app-providers.tsx`).

### Public marketing site (`Frontend/src/app/(public)/`)

The marketing surface (landing page + `/about`, `/product`, `/pricing`, `/contact`, `/security`, `/sample-report`, `/compare/{crayon,klue}-alternative`, `/legal/*`) has its own visual identity, distinct from the dashboard app:

- **Cream on near-black, gold only inside imagery** — the `(public)` layout wrapper carries the `theme-forest` class, which overrides the shadcn semantic CSS variables in `globals.css`. **The one rule that makes this palette work: the interface is parchment cream (`ink` `#E1D9C1`, also `--primary`/`--ring`) on a warm near-black, and warm gold appears ONLY as light inside imagery — the signal fields, the hero mockup's Brand Health ring, the `.signal-ignite` rim pulse. Never on a button, link, label or border.** Gold therefore lives in its own `--glow` token (`40 94% 56%`), which `readPalette()` in `signal-runtime.ts` reads *instead of* `--primary`; putting gold back into a UI token collapses the distinction. **The class name is a leftover** — the canvas was forest green until July 2026, then dark brown, and the name was kept to avoid a rename across the layout, components and docs. The dashboard/auth app keeps the cool blue `:root` values. Paired raw Tailwind colors: the `obsidian` ladder (950–600, warm near-black), `ink`, and the now-cream `cta` ramp — **marketing surface only**, don't use them in dashboard components; conversely don't use `brand-*` blues on marketing pages. Literals that can't reference tokens and must be swept by hand: `.text-gradient-primary` and `.bg-grid-fade` in `globals.css`, `ink`'s RGB in `shadow-[inset_0_1px_0_rgba(225,217,193,…)]` hairlines across marketing components, and the obsidian stops in the reading scrims (hero, problem section, `PageHero`). **Those hairlines are Tailwind arbitrary values — never put spaces inside them** (`rgba(225,217,193,0.08)`, not `rgba(225, 217, 193, 0.08)`), or the class silently fails to generate.
- **"You" is cream, competitors are blue** — self-brand indicators on marketing pages (share-of-voice bars, "You" labels) use `bg-primary`/`text-primary`; competitor bars use `blue-500/*`. Emerald was the original self color — don't reintroduce it on marketing pages. Note this is marketing-only: the dashboard's own Share-of-Voice chart still uses emerald for the self series. The shared `significance-*` scale (green/yellow/red) is a status ramp used by both surfaces — leave it alone.
- **Logo**: the compass mark (`/Kironyx_logo.svg`, mirrored in `/logo.svg` + `favicon.ico`) was recolored July 2026 from blue to the warm gold ramp (pixel remap of the original Canva PNG: blues→gold, cyan highlights→bright gold, whites→cream). `components/shared/logo.tsx` hardcodes `text-[#F8B225]` (the `--glow` gold) on the wordmark's "X" — a literal, not a semantic token, so the logo renders identically in the app and on marketing. `/public/Kironyx .svg` (note the space) is an unreferenced stray still carrying the old blue mark.
- **Signal-field motion system** — every animated background on the public surface runs on `components/landing/signal-runtime.ts`, which owns the sprite-atlas cache (one per color, shared page-wide), DPR sizing, in-place rescale on resize, rAF paused off-screen and in background tabs, and a single still frame under `prefers-reduced-motion`. Two consumers: `signal-collapse.tsx` (the hero set-piece, with its own timeline, converging on `[data-signal-target]` and firing the `.signal-ignite` CSS cue — and, via the `kx-signal-delivery` CustomEvent contract in `feed-data.ts`, telling the `LiveFeed` mockup to materialize the finding paired to each collapse/ignition, so the animation visibly *creates* feed entries) and `signal-field.tsx` (`<SignalField mode>` — `unresolved` / `conduit` / `lattice` / `converge` / `drift`, placed on the problem, how-it-works, features, footer-CTA sections and `PageHero`). The `conduit` mode measures `[data-signal-gate]` elements to align its transitions to the numbered steps. Colors come from the live CSS custom properties at runtime, so a token change follows through without touching the effects. Pricing and FAQ are deliberately left with no field.
- **Display font** — Fraunces (serif) is loaded in `(public)/layout.tsx`, NOT the root layout, so the font payload is scoped to public routes. Exposed as `font-display` / `--font-display`; marketing headings use it, the app never does.
- **Component split** — `components/landing/` holds the landing-page sections plus reusable animation primitives (`Reveal` scroll-reveal, `CountUp`); `components/marketing/` holds shared subpage building blocks (`PageHero`, `CompareTemplate` — the layout both `/compare/*` pages feed with data).
- **Film grain** — the public layout renders a fixed `.bg-noise` overlay (inline-SVG fractal noise) to kill gradient banding on the dark canvas; it's `pointer-events-none` and `aria-hidden`.
- **Reduced motion** — decorative animation utilities (`animate-aurora`, `animate-marquee`, …) are force-disabled under `prefers-reduced-motion` via a block at the bottom of `globals.css`. If you add a new looping/decorative animation, add it to that list.
- **`StorageNotice` is per-layout, not global** — it renders inside each route-group layout (`(public)`, `(auth)`, `(dashboard)`, `onboarding`), not the root layout. A new route group needs its own instance.

### Auth Flow

Cognito JWT → tokens in localStorage → `AuthProvider` hydrates on mount, checks token expiry every 60s → `AuthGuard` component wraps protected routes and enforces onboarding completion.

**Token refresh (Wave 2):** sessions survive past the 1-hour id-token validity via public `POST /auth/refresh` (Cognito `REFRESH_TOKEN_AUTH`; `auth: false` because the caller's id token is expired by definition — the 30-day refresh token is the credential). Frontend side lives in `lib/auth/token-refresh.ts`: **single-flight** `refreshSession()` (a module-level promise so N simultaneous 401s trigger one refresh; uses raw `fetch` deliberately since `apiClient` depends on this module). `AuthProvider` proactively renews 2 minutes before expiry and only treats a **401** from refresh as session death — network flakes/500s retry with backoff instead of nuking valid tokens. Gotcha: Cognito's refresh flow does NOT return a new refresh token; use `storeRefreshedTokens()` (which leaves the stored refresh token untouched) — calling `storeTokens` with `undefined` would blank it and kill renewability.

### Workspaces & Tenancy (Phase 4a/b/c)

Every authenticated handler resolves a **TenantContext** before doing any work — `resolveTenantContext(email, requestedWorkspaceId?)` in `shared/middleware/tenant.ts` translates the JWT email into:
- **`tenantUserId`** — the workspace owner's userId; all shared entities (Competitor, Subscription, Recommendation, SavedView, Battlecard, etc.) are keyed under `USER#<tenantUserId>` so every member of the workspace sees the same data.
- **`callerUserId`** — the actual signed-in user. Use for audit attribution + caller-scoped entities (Notification, AuditEvent actor, ApiKey creator).
- **`workspaceId`, `workspaceName`, `role`** — workspace identity + the caller's role.

Resolution order: email → `callerUserId` (GSI3) → memberships under `USER#<callerUserId>` / SK `MEMBERSHIP#`. If the caller has multiple workspaces, the **`X-Workspace-Id`** header (sent by the frontend from `localStorage.kx_current_workspace_id`) picks the active one; otherwise the resolver falls back to the caller's own workspace. Legacy users with no memberships return `tenantUserId === callerUserId`.

**Three-role hierarchy (Phase 14):** `owner > admin > member`. Owners can do anything; admins can invite/remove members and edit content; members are read-only-ish. Role gates live in handlers — search for `requireOwner` / `requireAdminOrOwner`. Admins **cannot invite other admins** — that's gated to owners only to prevent admin-as-second-owner attacks.

**Ownership transfer (Phase 4c):** uses `tenantUserId` (immutable, the original creator) vs `ownerUserId` (mutable, current owner) split with a lazy resolver fallback — no data migration needed.

### Capability Gating (Phase 6 / Phase 19 / Phase 20)

Tier-gated features go through `hasCapability(user, 'pdfExports')` from `shared/utils/capability.ts`, fed by the `CAPABILITIES` matrix in `shared/types/capabilities.ts`. The frontend mirrors this manually in `Frontend/src/lib/utils/capabilities.ts` + `lib/hooks/use-capability.ts` — when adding a new capability flag, update **both files** plus the union type on `hasCapability`'s parameter and the `useCapability` hook. Backend remains the enforcement source of truth; frontend uses the mirror only for UI gating (showing/hiding upgrade prompts, disabling buttons).

Current capability flags: `pdfExports`, `csvExports`, `slackIntegration`, `webhookIntegration`, `predictedMoves`, `customRecommendationCategories`, `scheduledReports`, `apiAccess`, `comparatorMatrix`, `brandPulse` (Phase 23 — self-brand monitoring + Phase 24 comparative analytics, true on all tiers), `audioBriefing` (audio version of the weekly digest, Strategist+ only — false on Scout). Numeric capacity flags (`recommendations.maxVisible`, `seats.max`, `savedViews.max`, `apiKeys.max`) are read directly from `capabilitiesFor(user)` rather than via the boolean check.

### Public API (Phase 11/13)

**`/v1/*` routes are X-API-Key authenticated, NOT Cognito.** Routes registered in `api.stack.ts` with `auth: false` and a separate middleware `resolveApiKeyContext()` that hashes the incoming key (SHA-256), looks up the row by `APIKEY#<hash>` PK, and returns the workspace + scope. Keys have a `scope` enum (`'read'` default / `'write'`) — write-scope routes (`POST /v1/competitors`, `PATCH /v1/recommendations/{id}`) reject read-only keys at the handler. Pre-Phase-13 keys default to `'read'` via `keyRow.scope ?? 'read'` so nothing breaks. Same defensive-default pattern for the per-minute quota: keys predating the field get 60 req/min (a comparison against `undefined` used to disable throttling entirely).

### Public token-share routes

Several public routes are token-validated rather than auth'd: invitations (`/invitations/{token}/accept`), cancellation feedback (`/cancellation-feedback/{token}`), public battlecards (`/public/battlecards/{token}`). Pattern: ULID token in the URL path, looked up via either a dedicated PK (`INVITE#<token>`, `CANCEL_FEEDBACK#<token>`) or a GSI3 reverse-index (`BATTLECARD_TOKEN#<token>`). Validate `expiresAt` (epoch seconds) explicitly even though DDB TTL is set — TTL has up to 48h delay.

### In-app notifications (Phase 18)

Per-user, polling-based feed. Fire-and-forget `enqueueNotification()` in `shared/services/notifications.ts` mirrors `recordAuditEvent` — write failures log + continue, never roll back the underlying mutation. Storage: `USER#<recipientUserId>` / `NOTIF#<ts>#<ulid>`, 90-day TTL. Notification kinds: `invitation.accepted`, `workspace.member_removed`, `workspace.role_changed`, `workspace.ownership_received`, `workspace.ownership_handed_off`. Frontend polls every 60s via `useNotifications()`.

### ID Generation

Uses ULID (`generateId()` in `shared/utils/id.ts`) — time-sortable, conflict-free.

### Secrets

Lazy-loaded singleton with 5-minute TTL cache (`shared/services/secrets.ts`). Pulls from AWS Secrets Manager (`kironyx/api-keys`): `PADDLE_SECRET_KEY`, `PADDLE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` (optional — weekly audio briefing). (`FIRECRAWL_API_KEY` was removed with the Firecrawl pipeline — no longer required or read.)

### AI Models & Anthropic call patterns

All Anthropic calls go through `callAnthropic()` in `shared/services/anthropic.ts`. Use it for any new Claude call you add; do not call `fetch('.../v1/messages')` directly. Beyond the `fetch`, the wrapper now owns three cross-cutting concerns added in Issues 7/8/9 (see `docs/LAUNCH_ISSUES.md`):
- **429 retry** with backoff (honors `retry-after` header, default 65s, max 2 retries).
- **Input-TPM rate-limit bucket** (`awaitRateLimitClearance`) — a per-minute DynamoDB token bucket (`RATELIMIT#ANTHROPIC_INPUT_TPM` / `MINUTE#<key>`) pre-checked before each call. Over the 25k/min threshold (30k org limit − 5k headroom) it sleeps to the next minute boundary and retries once, releasing the stale minute's reservation before re-reserving (no double count). `deepResearch` estimates get an **8× web_search amplification factor** — the raw prompt is ~10–20% of that op's real input. **Fail-open**: any DDB error proceeds with the call (better to risk a 429 than block on our own tracker).
- **Real-time cost cap** — `atomicAddGuarded` (month-guarded ADD that RESETs on month rollover, so June's spend never carries into July) bumps the per-user `monthToDateCostUsd` cache as calls complete. The 3am `aggregate-ai-costs` cron is a **reconciler** — `max(cache, Σ CostDay of current month)` — NOT a re-adder; re-ADDing what the real-time path already counted once halved every user's effective budget. Audit-log + cost writes are awaited (fire-and-forget was silently dropped by Lambda freeze).
- **Forensic AI audit log** (`persistAiLog`) — fire-and-forget row per call (`AILOG#<yyyy-mm>` / `CALL#<ts>#<aiCallId>`) capturing `opName`, `model`, `userId`, `promptHash`, truncated response (4 KB), HTTP status, duration, token counts, and cost. 365-day TTL; write failures log + continue, never propagate.

- **Claude Sonnet 4.5** (alias `claude-sonnet-4-5`):
  - `deepResearch()` — research with native `web_search_20250305` tool, max 8 uses/run, max_tokens **16384** (raised from 4096 — Phase 0 prompt enrichment's `derivedState` + per-finding metadata blew past the old limit and truncated mid-array; you only pay for tokens actually generated)
  - `detectResearchDeltas()` — compares prior vs current `ResearchFinding`, max_tokens **16384** (large because it generates detailed deltas + impact analysis). Has a `parseDeltasJson()` helper that does **partial JSON recovery** if Claude truncates mid-array — salvages every complete delta object before the cut-off rather than discarding the whole response.
  - `generateWeeklySummary()` — strategic briefing prose for the competitive digest email
  - `generateComparativeBriefing()` — PR-flavoured briefing for the Phase 24 Comparative Briefing email; returns prose + 2–3 suggested narrative angles. max_tokens 1500, ~$0.01–0.02/call. Soft-degrades to raw text if the JSON envelope can't be parsed.
  - `generateRecommendations()` — Phase 2 strategic recommendations for the weekly digest (separate call from the summary prose)
  - `predictNextMoves()` — forward-looking 30/60/90-day predictions per competitor (~$0.02)
  - `evaluatePriorPredictions()` — grades the previous run's predictions against what actually happened, feeding `predictionHistory` on the Competitor record
  - `suggestCompetitors()` — onboarding-time competitor discovery from the user's company/industry
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`):
  - `scoreCompetitorThreat()` — 1-2 sentence threat rationale + level (~$0.002/call)
  - `suggestWinAgainstTactics()` — 3-5 sales-enablement tactics for the battlecard (Phase 21, ~$0.005/call); cached on the Competitor record keyed by `winAgainstTacticsResearchId` so regenerating the same battlecard within one research cycle skips the call.
  - `classifyResearchTarget()` — pre-research input classifier rejecting person names / sanctioned entities (Compliance Phase 1)
  - `analyzeChange()` (legacy, unused after the deep-research refactor — kept for reference)

All AI surfaces (dashboard cards, weekly digest email, battlecard PDF) carry an AI disclaimer footer — see `Frontend/src/components/dashboard/ai-disclaimer.tsx` and the footer line in the PDF renderers. Score explanations live on the `/dashboard/methodology` page (content in `Frontend/src/lib/content/methodology.ts`); threat/significance/momentum/brand-health UI elements link to its anchors via the `ScoreInfo` ⓘ component (`components/dashboard/score-info.tsx`).

**Do not pin Sonnet to a dated snapshot without confirming it exists.** A bad snapshot ID (`claude-sonnet-4-5-20241022`, which is actually a 3.5 Sonnet date) shipped once and caused silent 404s. The alias `claude-sonnet-4-5` is the safe default.

### AI Deep Research (web_search tool)

`deepResearch()` uses Anthropic's `web_search_20250305` **server tool** — Claude manages the search loop internally, no client-side tool-use loop is needed. Single `fetch` call returns `content[]` with a mix of `text`, `server_tool_use`, and `web_search_tool_result` blocks; citations come from `web_search_tool_result`, the structured JSON answer from the final text block. The prompt asks for findings in 5 base categories (`news`/`product`/`funding`/`hiring`/`social`) plus a `derivedState` summary block (`stage`, `fundingState`, `hiringState`, `strategicDirection`, `techPositioning`, `pacing`, `evidenceNotes`) and per-finding `sentiment` + `timeSensitivity` metadata.

**Industry-aware 6th category (`industryContext`)**: when the user has an industry set, the prompt gains a sixth bucket whose label and guidance come from `INDUSTRY_RESEARCH_CONFIGS` in `shared/utils/industry-research.ts` (e.g. "Regulatory & Compliance" for Fintech, "ARR & Customer Wins" for SaaS), plus per-category guidance sentences appended to the 5 base buckets. Config keys MUST match the `INDUSTRIES` literal in `Frontend/src/lib/utils/constants.ts`; industry "Other" has no config, so the sixth bucket is dropped. The label is snapshotted on the ResearchFinding as `industryContextLabel` so historical findings keep their original label if the user later changes industry.

**Eligibility gate**: every research-triggering handler (`competitors/create` + `bulk-import`, `competitors/research`, `brand/research` + `brand/setup`, `users/onboard`, `v1/competitors-create`, the recurring-research enqueuer) calls `enforceResearchEligibility()` from `shared/utils/research-eligibility.ts` BEFORE starting the pipeline. Sequence: account-status check → monthly cost cap (reads the real-time `monthToDateCostUsd` cache; per-user `monthlyTokenBudget` override trumps the tier cap) → sanctions/personal-name denylist (sync) → per-day rate limit (a two-phase **conditional write** on the User row: window ADD-with-headroom, guarded reset on day rollover — a plain read-modify-write let parallel requests all pass) → Haiku `classifyResearchTarget()` (**fail-closed** on classifier errors; a classifier rejection refunds the daily-quota slot it claimed). Returns a typed `IneligibilityCode` so handlers map rejections to specific 400/403/429 responses.

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

The discriminator approach (vs a separate Brand entity) means every key builder, query helper, enrichment block, and the entire `deep-research.ts` Lambda is reused as-is. The cost is a **filter-discipline rule**: every endpoint that lists competitors must exclude self rows. Use `competitorsOnly()` / `isCompetitorTarget()` from `shared/utils/competitor-target.ts`. Already applied to: `competitors/list`, `competitors/create` + `bulk-import` (so self doesn't consume a plan-limit slot), `v1/competitors` + `v1/competitors-create`, `search`, the weekly digest pipeline (aggregate-changes, generate-recommendations, send-saved-view-digests), the PDF/CSV exports. Account delete and GDPR export deliberately do NOT filter — they want everything. `competitors/get`, `competitors/research`, and `competitors/battlecard` 404 on self rows so the UI surface stays consistent (and no one pays for "win against yourself" tactics).

**Deliberate non-filter exception — the comparator matrix**: the matrix endpoint returns the self row like any other, and the frontend (`dashboard/compare/page.tsx`) matches it by id against `GET /brand`, pins it to the top as the reference line with a "You" badge (emerald, matching the Share-of-Voice self-series color), and routes its click to `/dashboard/your-brand` (the competitor detail endpoint 404s on self rows). Don't "fix" the matrix by filtering self out — the You row is the point.

The self-brand surface is `/brand/*`: `GET /brand`, `POST /brand/research`, `GET /brand/coverage`, `GET /brand/sentiment`, `GET /brand/health` (Phase 24), `POST /brand/setup`. Handlers share `loadSelfBrand()`, `loadUserForBrand()`, and `assertBrandPulseCapability()` from `api/brand/_shared.ts`. The frontend mirror is at `Frontend/src/app/(dashboard)/dashboard/your-brand/`.

### Comparative analytics (Phase 24)

Three features built on Phase 23, gated by the same `brandPulse` capability:

- **Share of Voice** — `GET /analytics/share-of-voice?window=7d|30d|90d` returns per-entity coverage breakdown across all 6 research categories (the 5 base ones + `industryContext`). Pure aggregation in `shared/utils/share-of-voice.ts` over recent Change records. Window is clamped to the tier's `PLAN_LIMITS[plan].historyDays`. Frontend renders at `/dashboard/compare/share-of-voice` using `ShareOfVoiceChart` (stacked horizontal bars, no chart library).
- **Brand Health Score** — `GET /brand/health` returns a composite 0–100 KPI + three components (sentiment / voice / momentum) + a `confidence` bucket (`low | medium | high`) based on mention volume. Pure rules in `shared/utils/brand-health.ts` with the formula `round((sentimentScore + voiceScore + momentumScore) / 3)` — no AI cost. Card rendered by `BrandHealthScoreCard` (default variant on Your Brand, `size="sm"` on the dashboard home).
- **Comparative Weekly Briefing** — PR-flavoured email variant running on its own state machine (`ComparativeBriefing`) at Mon 10am UTC. Opt-in via `notificationPreferences.email.comparativeBrief === true`. Pipeline: `get-comparative-subscribers` (opt-in + capability + self-row existence filter) → MAP(maxConcurrency=5) → `aggregate-brand-coverage` → `generate-comparative-briefing` (Sonnet) → `render-send-comparative-brief` (SES via the email-only adapter, NOT `dispatchWeeklyDigest()` because that's gated by the `weeklyDigest` preference and fans out to Slack/webhook). The Mon 10am slot is chosen to offset cleanly from the existing Mon 8am competitive digest and Mon 9am saved-view digests.

Both pure-aggregation utils have colocated unit tests (`share-of-voice.test.ts`, `brand-health.test.ts`) — useful templates for any future Phase 25+ scoring work.

### Step Functions concurrency

`MapResearch` in `pipeline.stack.ts` uses **`maxConcurrency: 1`** to serialize per-minute Anthropic token usage and avoid rate-limit pile-ups during multi-competitor onboarding. Each research run can burn 10-20k input tokens across 2-3 Sonnet calls; running 3 in parallel reliably trips the 30k input-tokens-per-minute org limit. If you change this back to >1, re-test multi-competitor onboarding.

### Analytics events (Phase 5)

Funnel events are emitted as structured JSON via `logger.info(eventName, metadata)` and queryable via CloudWatch Logs Insights. Note the logger (`shared/utils/logger.ts`) passes all metadata through `redactObject()` from `shared/utils/redact.ts` — sensitive key names (password/token/secret/api-key/...) and secret-shaped values (JWTs, `sk-ant-*`, `pdl_live_*`, Bearer tokens) are replaced with `[REDACTED]` before hitting CloudWatch. Defence-in-depth only; don't rely on it as permission to log request headers/bodies. Events: `signup_started`, `signup_completed`, `signin_attempt`, `signin_succeeded`, `signin_failed`, `verification_resent`, `onboarding_completed`, `first_research_completed`, `recommendation_acted_on`, `recommendation_dismissed`. Insights example: `filter message = "onboarding_completed" | stats count(*) by bin(1d)`. **No client-side tracking pixel** — every event fires from a backend handler at the known transition point. Don't grep the frontend for these names.

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
| Self-brand pointer | `USER#<tenantUserId>` | `SELF_BRAND` | Wave 3 — atomic one-self-row-per-workspace claim |
| OFAC SDN drift tracker | `OFAC_SDN` | `META` | Compliance Phase 1, drift cron |
| AI audit log | `AILOG#<yyyy-mm>` | `CALL#<ts>#<aiCallId>` | Issue 9 forensic log, 365-day TTL (written by `callAnthropic`) |
| Anthropic TPM bucket | `RATELIMIT#ANTHROPIC_INPUT_TPM` | `MINUTE#<key>` | Issue 8 per-minute token bucket, 120s TTL |

The `Snapshot` entity from the original Firecrawl pipeline is no longer written. Old snapshot rows from before the deep-research refactor still exist (and the SK prefix `SNAP#` is reserved) but no code path reads them today.

**GSIs**:
- **GSI1** — user's combined feed; stores `CHANGE#<ts>`, `RESEARCH#<ts>`, and `REC#<ts>` SK prefixes (filter with `begins_with`)
- **GSI2** — all active competitors (PK=`ACTIVE`); originally for the daily cron, still used by Step Function input collectors
- **GSI3** — multi-purpose reverse index keyed by `GSI3PK` (KEYS_ONLY — resolve the base-table PK/SK, then `getItem` the full row):
  - `<email-lowercased>` → user by email (every authenticated route's first step)
  - `BATTLECARD_TOKEN#<token>` → public battlecard share-token lookup (Phase 20)
  - `CHANGE_ID#<changeId>` (GSI3SK carries `COMP#<competitorId>`) → O(1) change-by-id for `GET /changes/{id}` permalinks (Wave 3). Only rows written since then carry these keys; legacy rows fall back to a paginated GSI1 walk.

The **Competitor** record carries derived intelligence written by the enrichment block: `momentum`, `momentumChangePercent`, `momentumAsOf`, `threatLevel`, `threatReasoning`, `threatAsOf`, `derivedTags`, `derivedTagsAsOf`, `predictedMoves`, `predictionHistory`. Plus the lazy-populated `winAgainstTactics` cache (Phase 21) keyed by `winAgainstTacticsResearchId` so battlecard regeneration within one research cycle skips the Claude call. All read directly by the list/detail endpoints without recomputation. **`targetKind`** (Phase 23) discriminates competitor vs self-brand rows; threat/predicted-moves fields stay unset for self rows. **`lastResearchedAt`** (Wave 1) is stamped in `deep-research`'s core path on every successful run and drives recurring-research cadence. The competitor **detail** endpoint computes momentum over the same 100-change window as the stored enrichment and returns the stored `momentumAsOf` — keep these consistent or the detail page disagrees with the sidebar/list.

The **User** record gained `companyWebsite?` (Phase 23) — seeds the self-brand Competitor row at onboarding or via `POST /brand/setup`.

Key builders in `shared/db/keys.ts`. Query helpers (`getItem`, `putItem`, `queryByPK`, `queryGSI`, `updateItem`) in `shared/db/queries.ts`, plus the atomicity toolkit added in Wave 3 (see next section). Pure-function metrics (`computeMomentum`, `buildChangesByDay`, `deriveTagsFromState`) live in `shared/utils/competitor-metrics.ts`; SoV and Brand Health utilities (`computeShareOfVoice`, `computeBrandHealthScore`) in `shared/utils/share-of-voice.ts` and `shared/utils/brand-health.ts`; the self-vs-competitor filter helpers (`isCompetitorTarget`, `competitorsOnly`) in `shared/utils/competitor-target.ts`.

### Atomic write helpers (Wave 3)

`shared/db/queries.ts` grew a set of race/atomicity primitives — reach for these instead of read-modify-write patterns, which have all been purged:

- **`transactWrite(items)`** — one atomic `TransactWriteItems` commit, all-or-nothing; **throws** past `TRANSACT_MAX_ITEMS` (100) rather than silently splitting. Used by `deep-research.ts` to persist the ResearchFinding + all its Change rows together (a partial persist made the new finding the baseline and permanently hid the unpersisted deltas from re-detection).
- **Atomic counters** — `initCounterIfAbsent` / `incrementWithCeiling` / `decrementFloorZero`. Plan limits are enforced by a `competitorCount` counter with ceiling on create / bulk-import / v1-create / delete — do NOT count-then-put.
- **`putItemIfNotExists`** — conditional claim. Used for the one-self-brand-row-per-workspace guarantee via a deterministic pointer row (`USER#<tenantUserId>` / `SELF_BRAND`, see `api/brand/_shared.ts`) claimed by brand/setup + onboarding.
- **`atomicAddGuarded`** — month-guarded ADD with RESET on rollover (the real-time cost cap).
- **`appendToList`** — `list_append` for ResearchRun (Phase 22) event timelines; events are APPENDED so the trigger's `run_queued` entry survives `deep-research`'s later flushes (a SET overwrote it).
- **`skPrefixRange` / `skBetween`** — prefix-safe `since` ranges (see "Pagination").

## Pipeline Flow (Step Functions)

**Research pipeline** (`Backend/src/functions/pipeline/deep-research.ts` — single Lambda, mapped over competitors with `maxConcurrency: 1`, then chained to `send-alert`):

The `deep-research` Lambda owns the full per-competitor flow internally — there are no smaller chained Lambdas like the old daily pipeline had. Order matters:

1. **Load prior `ResearchFinding`** from DynamoDB (newest first via descending SK scan, may be null on first run)
2. **`deepResearch()`** — Sonnet + web_search → current findings, citations, derivedState
3. **`detectResearchDeltas()`** — Sonnet compares prior vs current, returns array of new items with impact analysis. **Runs BEFORE persisting the new finding** so a Claude failure leaves the prior baseline intact for clean retry.
4. **Persist the new `ResearchFinding` (with full `derivedState`) + every delta as a `Change` record in ONE `transactWrite`** — Change rows carry `researchId`, `citations`, `sourceCategory`, and GSI3 `CHANGE_ID#<id>` keys for permalink lookup. Atomicity matters: a partial persist silently makes the finding the new baseline and hides the unpersisted deltas forever.
5. **Stamp `lastResearchedAt`** on the Competitor (core path, any trigger) — the authoritative signal the recurring enqueuer keys cadence off (distinct from `momentumAsOf`, which only moves when enrichment succeeds; and never fall back to `updatedAt` — unrelated edits postponed research a full cycle)
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

**Digest fault tolerance (Wave 1):** each Map iteration has its own catch (a Pass state inside the iterator — a Map-level catch would still abort the whole batch, one bad user killing everyone's digest). `generate-summary`/`generate-recommendations` soft-degrade on AI failure; `render-send-email` survives a failed user load; users with zero competitors (workspace members, empty accounts) are skipped rather than sent misleading "all stable" ghost digests. The comparative-briefing Map has the same per-iteration catches.

**Audio briefing (Demo-wow Phase 2):** for `audioBriefing`-capable users (Strategist+), `render-send-email` also synthesizes an audio version of the digest via ElevenLabs Flash (`shared/services/elevenlabs.ts`), stores the MP3 (`shared/services/audio-briefing-storage.ts`), and links it in the email. Gated by the `audioBriefing` capability flag; degrades silently to text-only if `ELEVENLABS_API_KEY` is unset.

**Comparative briefing (Phase 24)** — opt-in, separate state machine, same Map shape:
1. `get-comparative-subscribers` (opt-in + `brandPulse` capability + self-row existence) → 2. `aggregate-brand-coverage` (self + competitor mention counts, sentiment breakdown, SoV) → 3. `generate-comparative-briefing` (Sonnet, soft-degrades on JSON parse failure) → 4. `render-send-comparative-brief` (email-only via `sendEmailNotification`, bypasses `dispatchWeeklyDigest()`).

**Trigger entry points for the research pipeline**:
- Onboarding completion (`api/users/onboard.ts`) starts the ResearchPipeline with all newly-created competitors AND the self-brand row when `companyWebsite` was provided
- Manual "Research Now" buttons: `POST /competitors/{id}/research` for a single competitor, `POST /brand/research` for the self-brand row
- Sunday 6am UTC recurring-research enqueuer (`pipeline/enqueue-recurring-research.ts`) walks the active-competitor index and re-runs research based on each row's `researchCadenceDays` (or the tier default from `PLAN_LIMITS`), measured from `lastResearchedAt`. It passes each row's `targetKind` through so scheduled self-brand runs keep the `'self'` framing (Wave 1 — they used to get threat scores + predicted moves written onto the self row every Sunday)

**Other EventBridge schedules** (in `pipeline.stack.ts` unless noted):
- Mon  8am UTC — WeeklyDigest state machine
- Mon  9am UTC — `send-saved-view-digests` Lambda (Phase 15)
- Mon 10am UTC — ComparativeBriefing state machine (Phase 24)
- Sun  6am UTC — recurring-research enqueuer
- Sat  7am UTC — `refresh-ofac-sdn` (Compliance Phase 1 OFAC SDN drift check — wired in `monitoring.stack.ts`, not Pipeline)
- Daily 3am UTC — `aggregate-ai-costs` (per-user CostDay rollup, drives monthly cost-cap enforcement)
- Daily 4am UTC — `send-retention-nudges` (Phase 8a, 90-day per-user cooldown; stamps `lastRetentionNudgeAt` BEFORE sending so a failed stamp can't re-mail daily)
- 1st of month 8am UTC — `send-scheduled-reports` (Phase 6c, Command-tier PDF briefing)

**Cron reliability (pre-soft-launch hardening):** every EventBridge cron rule has a dead-letter queue with bounded delivery (3 retries / 1h max age) and a messages-visible ≥ 1 alarm. Each stack owns its **own** DLQ — an EventBridge DLQ's queue policy must reference the consuming rule ARNs, so sharing Pipeline's queue from Monitoring/StatusPage creates a cyclic cross-stack dependency (caught at synth). All Lambdas have 90-day log retention via the `logRetention` prop (chosen over explicit LogGroups; the Api stack sits at ~211 of CloudFormation's hard 500-resource limit post-consolidation, and the template test asserts it stays under 350).

## Pricing Tiers & Plan Limits

| Tier | Price | Max Competitors | History |
|------|-------|-----------------|---------|
| Scout | $49/mo | 3 | 30 days |
| Strategist | $99/mo | 10 | 90 days |
| Command | $199/mo | 25 | 1 year |

Defined in `PLAN_LIMITS` from `shared/types/index.ts`. Enforced via the atomic `competitorCount` counter (`incrementWithCeiling`) in create / bulk-import / v1-create, decremented on delete — see "Atomic write helpers". Payments handled via Paddle (checkout sessions, customer portal, webhook lifecycle events).

## Environment Variables

**Backend Lambda** (set via CDK): `TABLE_NAME`, `BUCKET_NAME`, `USER_POOL_ID`, `USER_POOL_CLIENT_ID`, `SECRETS_ARN`, `FRONTEND_URL`, `FROM_EMAIL`. Lambdas that trigger the research state machine (`api/users/onboard.ts`, `api/competitors/research.ts`, `api/brand/research.ts`, `api/brand/setup.ts`) get `RESEARCH_PIPELINE_ARN`. Subscription checkout gets `PADDLE_PRICE_SCOUT`/`_STRATEGIST`/`_COMMAND`. (`DAILY_PIPELINE_ARN` is gone with the daily scrape pipeline.)

**CDK deploy** (required for `cdk deploy`): `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION` (defaults to us-east-1), `FRONTEND_URL` (for API CORS — **must match the Amplify URL exactly**, e.g. `https://main.d1zrq9gf129s9u.amplifyapp.com`, or CORS blocks the browser), `FROM_EMAIL`, `PADDLE_PRICE_*`. Optional: `ALERT_EMAIL` (subscribes the alarms SNS topic AND enables the monthly AWS cost budget — the budget is skipped with a synth-visible warning when unset; **set it before a real deploy**), `AWS_BUDGET_MONTHLY_USD` (default $50). `bin/app.ts` validates `CDK_DEFAULT_ACCOUNT` and `FRONTEND_URL` at synth time. A populated `Backend/.env` can be sourced with `set -a && source .env && set +a`.

**Frontend** (Amplify app-level env vars): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`. **These are inlined at build time**, not read at runtime — after changing them in Amplify console you MUST trigger a rebuild (`aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE`), otherwise the old localhost-fallback bundle keeps serving.

## Deploy Notes

- **Backend** deploys via `cdk deploy --all` from `Backend/` after sourcing `.env`. Individual stacks: `cdk deploy Kironyx-dev-Pipeline Kironyx-dev-Api`.
- **Frontend** deploys automatically on push to `main` (Amplify tracks the GitHub repo). Manual: `aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE`.
- AWS region is **us-east-1**. Paths with leading `/` (CloudWatch log group names, IAM ARNs) passed to `aws` CLI from Git Bash on Windows get mangled — prefix with `MSYS_NO_PATHCONV=1`.
- `cdk synth` requires `FRONTEND_URL` and `CDK_DEFAULT_ACCOUNT` set or `bin/app.ts` throws at parse time — handy when scripting verification.

## PDF generation lambdas (Phase 6b / Phase 20)

Two PDF surfaces exist: the weekly briefing (`api/exports/pdf.ts` → `shared/utils/pdf-renderer.ts`) and the per-competitor battlecard (`api/competitors/battlecard.ts` → `shared/services/battlecard-pdf.ts`). Both use **PDFKit** + **S3** + **presigned URLs** (no Puppeteer).

Both PDF routes live in the dedicated **`Pdf` domain function** (`pdfFonts: true` in `route-manifest.ts`), which gets the memory/timeout override **and** the `commandHooks.afterBundling` hook (`pdfFontCommandHooks` in `api.stack.ts`) that copies PDFKit's `.afm` font metric files into the lambda bundle — esbuild treats them as binary assets and won't bundle them automatically. **If you add another PDF route, put it in the `Pdf` function** — a default-profile function is missing the .afm files, and the failure is lazy: the function cold-starts fine and only throws `Cannot find module ... data/Helvetica.afm` when a PDF is actually rendered. Memory: 1024 MB. Timeout: 60s.

The battlecard route serves PDFs through `GET /public/battlecards/{token}` (no auth) which **bypasses `apiHandler`** to emit a `Location:` header for a 302 redirect to a fresh 1-hour S3 presigned URL. Mirror that pattern if you add other public-share endpoints that return non-JSON.
