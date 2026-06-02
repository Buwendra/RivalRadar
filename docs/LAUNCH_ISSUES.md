# Launch-Impact Issues — Deep Dive + Programmatic Fix Plans

**Last reviewed**: 2026-06-02

## Context

All three demo-wow phases are live in production and the product is demo-ready. This document inventories every identified issue that affects (or will affect) **opening public signups**, ranked by severity, with implementation plans for every item that can be fixed programmatically. Non-programmatic items (lawyer engagement, SOC 2 audit, insurance) are noted at the bottom but not deep-dived.

The plans below are designed to be executed in sequence; each one cites the existing functions and patterns to reuse so we're not re-inventing pieces of the codebase that already exist.

**Severity legend**

- 🔴 Hard blocker — must ship before opening public signups
- 🟠 Security / quality gap — should ship before meaningful traffic
- 🟡 Operational risk — bites at scale, manageable pre-launch
- 🔵 Tech debt — quality-of-life

**Verified prerequisites (from the audit that produced this doc):**

- All 5 legal pages exist with real prose; `<DraftBanner>` flags Privacy / Terms / DPA as awaiting lawyer review.
- Re-consent banner ([Frontend/src/components/shared/reconsent-banner.tsx](../Frontend/src/components/shared/reconsent-banner.tsx)) is the reuse pattern for the cookie banner.
- API stack is at 496/500 CFN resources.
- WAF WebACL was removed earlier; status page is the only CloudFront construct in the codebase today ([Backend/lib/stacks/status-page.stack.ts](../Backend/lib/stacks/status-page.stack.ts)).
- `callAnthropic` already logs `aiCallId`, `promptHash`, cost; missing `aiResponseText` for forensic audit.
- CI today is a single `npm-audit.yml` workflow; no `tsc`/`vitest`/`lint`/`cdk synth` in CI; no branch protection on `main`.
- `RemovalPolicy.RETAIN` is already used on the DynamoDB table, Cognito pool, S3 bucket, and log group — the pattern is familiar.

---

## Issue 1 — Sub-processor notification subscription endpoint 🔴

### What it is
GDPR Art. 28(2) requires the data controller (RivalScan) to give customers a way to **be notified** when a sub-processor changes, with a **30-day objection window** before the change takes effect. The current `/legal/sub-processors` page lists the four sub-processors (AWS, Anthropic, Paddle, GitHub) in a static table — there's no mechanism for a customer to subscribe to updates.

### Why it blocks launch
Without this, any B2B prospect doing diligence will flag it; some won't sign without it. It's a hard pre-condition for accepting EU customers.

### Current state
- Page lives at `Frontend/src/app/(public)/legal/sub-processors/page.tsx` — has the table + last-updated date but no form.
- No `SubProcessorSubscriber` entity in DynamoDB.
- No notification mechanism in the weekly digest or anywhere else.

### Implementation plan

**1. New DynamoDB entity** — `SubProcessorSubscriber`

```
PK = SUBPROCESSOR_SUB
SK = EMAIL#<email-lowercased>
Fields: email, subscribedAt, source (defaults to 'sub-processors-page'),
        unsubscribeToken (ULID), confirmedAt? (for double-opt-in)
```

Bucketed all under one PK because the read pattern is "list all subscribers when we publish a change" — single query, no GSI. Unsubscribe is by token, so add a second access pattern:

```
GSI3PK = SUBPROCESSOR_UNSUB#<unsubscribeToken>
```

Add key builders to `Backend/src/shared/db/keys.ts` following the existing pattern (mirror `cancelFeedbackPK` style).

**2. New entity type** — `Backend/src/shared/types/sub-processor-subscriber.ts`

**3. Public endpoints** — three routes

- `POST /legal/sub-processors/subscribe` — public, no auth. Body: `{ email }`. Validates via Zod, generates ULID for unsubscribe token, writes the row with `confirmedAt: undefined`, sends a double-opt-in confirmation email via SES (reuse `sendEmail()` from `Backend/src/shared/services/notifiers/email-adapter.ts`). Returns 202 with "Check your inbox to confirm".
- `GET /legal/sub-processors/confirm/{token}` — stamps `confirmedAt`, shows a public confirmation page.
- `GET /legal/sub-processors/unsubscribe/{token}` — deletes the row, shows "You've been unsubscribed".

**Resource budget note**: 3 new routes × 6 CFN resources ≈ 18 resources. Stack is at 496/500 — this alone would tip it over. **This work depends on Issue 6 (nested-stack refactor) completing first.**

**4. Frontend form** — `Frontend/src/components/legal/sub-processor-subscribe-form.tsx`

Slot into the existing sub-processors page above the table. Email input + submit + post-submit "Confirmation email sent" state. Use TanStack Query mutation pattern from existing `Frontend/src/lib/hooks/`.

**5. Change-notification flow** — when the sub-processor list changes

A one-shot script `Backend/scripts/notify-subprocessor-change.sh` that:
1. Queries every subscriber under `PK = SUBPROCESSOR_SUB`.
2. Sends a templated email: *"We're adding [vendor] as a sub-processor effective [date 30 days from now]. Object by replying to this email."*
3. Logs the send count.

No state machine needed — this fires once when you make a sub-processor change, not on a schedule.

### Verification
- Submit your own email → receive confirmation email → click confirmation link → see "Confirmed" page → row in DDB has `confirmedAt` populated.
- Click the unsubscribe link → row deleted → see "Unsubscribed" page.
- Run the change-notification script with a test sub-processor row in DDB → confirm the email arrives.

### Effort
~1 session (3–5h). Cannot ship before Issue 6.

---

## Issue 2 — Cookie / storage notice banner 🔴

### What it is
ePrivacy Directive Recital 25 (the EU "cookie law") requires sites to **disclose** storage and cookie use, even when consent isn't needed (functional/auth tokens are exempt from consent under Recital 25, but disclosure is still mandatory). RivalScan uses `localStorage` extensively (`rs_id_token`, `rs_access_token`, etc.) and has no disclosure banner today.

### Why it blocks launch
EU regulators have issued fines for missing cookie banners even when no marketing cookies are set. It's a free-tier compliance item with no real downside to shipping.

### Current state
- No banner exists anywhere in the Frontend.
- `reconsent-banner.tsx` is the closest pattern (also a dismissible banner with persistence). It uses `sessionStorage` so the banner re-shows next session if not actioned. Cookie banner needs `localStorage` so dismissal is permanent.
- No central layout-level banner slot exists; layouts at `(public)/layout.tsx` and `(dashboard)/layout.tsx` would each need the banner.

### Implementation plan

**1. New component** — `Frontend/src/components/shared/cookie-notice-banner.tsx`

Mirror the reconsent-banner structure but use `localStorage` for permanent dismissal:

```typescript
const DISMISS_KEY = "rs_cookie_notice_acknowledged";

export function CookieNoticeBanner() {
  const [acknowledged, setAcknowledged] = useState<boolean>(() => {
    if (typeof window === "undefined") return true; // SSR
    return Boolean(localStorage.getItem(DISMISS_KEY));
  });

  if (acknowledged) return null;

  const handleAck = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setAcknowledged(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-md border border-brand-700 bg-brand-900/95 p-4 shadow-lg backdrop-blur">
      <p className="text-sm">
        RivalScan uses browser storage (localStorage) to keep you signed in.
        No tracking cookies; no third-party analytics. See our{" "}
        <Link href="/legal/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>{" "}
        for details.
      </p>
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={handleAck}>Got it</Button>
      </div>
    </div>
  );
}
```

**2. Slot it into both layouts** — `Frontend/src/app/(public)/layout.tsx` and `Frontend/src/app/(dashboard)/layout.tsx` (and `Frontend/src/app/onboarding/page.tsx` if desired). One line near each layout's closing tag.

**3. Verify text against the lawyer's policy text** once that lands. If they want different language, just edit the component.

### Verification
- Open the site in an incognito window → banner appears at bottom.
- Click "Got it" → banner disappears, `localStorage.rs_cookie_notice_acknowledged` is set.
- Refresh the page → banner stays dismissed.
- Clear localStorage → banner reappears.

### Effort
~0.25 session. No new deps. No backend changes.

---

## Issue 3 — WAF + CloudFront fronting + per-route auth throttling 🟠

### What it is
Three coupled problems with one fix:

1. **WAFv2 was removed** from the API stack because HTTP API v2 can't take a WAF directly (only REST API v1 or CloudFront can).
2. **Per-route auth throttling fails** for the same reason — HTTP API v2's `routeSettings` doesn't support per-route throttle properties (REST v1 only).
3. **No DDoS / bot protection** beyond AWS Shield Standard (auto-enabled, no managed rules).

### Why it matters
At any meaningful traffic level — say even 10–20 organic signups/day — credential stuffing, scraper bots, and SQL-injection attempts will start hitting `/auth/*` endpoints. Without WAF managed rules + rate-based rules, the only line of defense is Cognito's built-in lockout (effective for credential stuffing) and the default 100 RPS / 200 burst stage throttle (won't stop a distributed attack).

### Current state
- No `wafv2` references in `Backend/lib/stacks/api.stack.ts`.
- CloudFront pattern exists in `Backend/lib/stacks/status-page.stack.ts` (Phase 8c — public S3 origin, no API). That's the reuse template.
- All API traffic hits the HTTP API origin directly (`https://6xjghxskzd.execute-api.us-east-1.amazonaws.com`).
- API CORS allowlist is keyed on `FRONTEND_URL`, currently the Amplify URL.

### Implementation plan

**1. New CDK stack** — `Backend/lib/stacks/api-edge.stack.ts`

Creates:

- A WAFv2 `WebACL` scoped to `CLOUDFRONT` (must be in `us-east-1` regardless of API region — it already is) with:
  - `AWSManagedRulesCommonRuleSet` (OWASP top 10)
  - `AWSManagedRulesKnownBadInputsRuleSet` (SQL injection, RFI, etc.)
  - `AWSManagedRulesAmazonIpReputationList` (known bot IPs)
  - Custom rate-based rule: 5 req / 5 min per IP on `URI_PATH STARTS_WITH /auth/` (per-route auth throttle)
  - Default action: allow
- A CloudFront distribution with:
  - Origin: the HTTP API Gateway endpoint (custom origin, HTTPS only, OriginRequestPolicy `AllViewer` so headers + cookies pass through)
  - CachePolicy: `CACHING_DISABLED` (API responses must not be cached)
  - WebACL attached
  - Price class: `PRICE_CLASS_100` (US + EU only — same as status page)
  - Custom domain: defer (use the auto-generated `*.cloudfront.net` for now; add custom domain later via `aws acm` cert)

**2. Reconfigure the frontend** — `NEXT_PUBLIC_API_URL` env var in Amplify console changes from `https://6xjghxskzd...amazonaws.com` to the new CloudFront URL. Trigger an Amplify rebuild so the inlined build-time URL flips.

**3. CORS update** — the API CORS allowlist is `[FRONTEND_URL]`. The frontend origin doesn't change (still Amplify). What changes is that the frontend now calls the CloudFront URL instead of the API Gateway URL. CORS preflight still flows from the frontend's perspective. No CORS rule change needed.

**4. CSP update** — `Frontend/next.config.mjs` has `connect-src 'self' ${apiUrl} https://api.paddle.com ...` where `apiUrl` is `NEXT_PUBLIC_API_URL`. When the env var flips to CloudFront, the CSP automatically allows it (it's the same var). Verify post-deploy.

### Verification
- WAFv2 CloudWatch metrics show `BlockedRequests` after hitting `/auth/signin` 10 times in 5 min from one IP.
- `curl -X POST <cloudfront-url>/auth/signin` returns same response as before (proxied through).
- Browser dev-tools shows API calls now hitting `cloudfront.net` not `execute-api`.
- Latency increase: typically +5–15ms (CloudFront edge cache miss).

### Effort
~1–1.5 sessions. Cost: $15–30/mo at low scale ($0.085/GB egress + $1/rule/month for WAF + $0.60/1M WAF requests).

### Risks
- If CloudFront caches a response it shouldn't (rare with `CACHING_DISABLED` but a misconfig in `cache-control` headers from the API could leak), users see stale data. Mitigate by setting `cache-control: no-store` on every API response. Easy in `apiHandler` middleware.
- WAF false positives (managed rules occasionally block legit traffic). Start with `count` mode for 1 week, observe metrics, then flip to `block`. CDK supports both modes via `Action: { Allow: {} }` vs `{ Block: {} }`.

---

## Issue 4 — CSP report-uri / report-to (silent enforcement) 🟠

### What it is
The CSP was flipped from `Content-Security-Policy-Report-Only` to enforced `Content-Security-Policy` earlier, but no `report-uri` or `report-to` directive was added. Any violation today is silently blocked — no telemetry, no awareness.

### Why it matters
If a future change adds an external resource (a new analytics SDK, a font CDN, a third-party iframe) that isn't on the allowlist, the browser silently refuses to load it. Users see broken UI; we see nothing. This bites quietly.

### Current state
- `Frontend/next.config.mjs` has the enforced CSP without `report-uri` or `report-to`.
- No reporting endpoint exists on the backend.

### Implementation plan

**1. New endpoint** — `POST /csp-report` (public, unauthenticated)

Handler at `Backend/src/functions/api/public/csp-report.ts`:

```typescript
export const handler = apiHandler<PublicEvent>(async (event) => {
  const body = parseBody(event) as { 'csp-report'?: Record<string, unknown> };
  const report = body['csp-report'] ?? body;
  logger.warn('csp_violation', {
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number'],
    referrer: report.referrer,
    userAgent: event.headers?.['user-agent'],
  });
  return { statusCode: 204, body: {} as never };
});
```

Wire in `api.stack.ts` as a public route. **Resource budget**: 6 CFN resources. Bundles with Issue 6's nested-stack refactor.

**2. CSP header update** — `Frontend/next.config.mjs`:

```diff
- { key: "Content-Security-Policy", value: cspDirectives },
+ { key: "Content-Security-Policy",
+   value: `${cspDirectives}; report-uri ${apiUrl}/csp-report; report-to csp-endpoint` },
+ { key: "Reporting-Endpoints", value: `csp-endpoint="${apiUrl}/csp-report"` },
```

Both `report-uri` and `report-to` for browser-compat; `report-uri` is deprecated but still widely supported.

**3. CloudWatch alarm** — `Backend/lib/stacks/monitoring.stack.ts`: alarm when `csp_violation` log lines exceed 10/hour. Email alerts via existing SNS topic.

### Verification
- Add a deliberate CSP violation (e.g. load a script from a disallowed domain) in a test environment.
- Browser silently blocks but POSTs a JSON report to `/csp-report`.
- CloudWatch logs show the `csp_violation` line with full details.

### Effort
~0.5 session. Depends on Issue 6.

---

## Issue 5 — Real CI workflow + branch protection 🟠

### What it is
Today the only CI is `npm-audit.yml`. `tsc`, `vitest`, `next lint`, and `cdk synth` don't run on PRs. There's no branch protection on `main`, so a red audit (currently red on all 5 open Dependabot PRs) doesn't actually block merge.

### Why it matters
Type errors and broken tests can ship to `main` undetected. Public-repo without branch protection means anyone with push access (just you today, but the moment you have an external contributor) can bypass review entirely. This is the smallest engineering item with the biggest reduction-in-future-pain ratio.

### Current state
- `.github/workflows/npm-audit.yml` runs on PR + Sunday 6am UTC.
- No other workflows.
- `.github/dependabot.yml` schedules grouped weekly PRs.
- Branch protection on `main` is absent (confirmed via `gh api` earlier).

### Implementation plan

**1. New workflow** — `.github/workflows/verify.yml`

```yaml
name: verify
on:
  pull_request:
    paths:
      - "Backend/**"
      - "Frontend/**"
  push:
    branches: [main]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: Backend/package-lock.json }
      - run: cd Backend && npm ci --no-audit --ignore-scripts
      - run: cd Backend && npx tsc --noEmit
      - run: cd Backend && npx vitest run
      - name: cdk synth (only if infra changed)
        if: ${{ contains(github.event.pull_request.changed_files, 'Backend/lib/') }}
        env:
          CDK_DEFAULT_ACCOUNT: "076561717141"
          CDK_DEFAULT_REGION: us-east-1
          FRONTEND_URL: https://main.d1zrq9gf129s9u.amplifyapp.com
        run: cd Backend && npx cdk synth --quiet
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: Frontend/package-lock.json }
      - run: cd Frontend && npm ci --no-audit --ignore-scripts
      - run: cd Frontend && npx tsc --noEmit
      - run: cd Frontend && npm run lint
```

**2. Branch protection** — scripted via `gh api`:

```bash
gh api -X PUT repos/Buwendra/RivalRadar/branches/main/protection \
  -F required_status_checks='{"strict":true,"contexts":["backend","frontend","audit (Backend)","audit (Frontend)"]}' \
  -F enforce_admins=false \
  -F required_pull_request_reviews='{"required_approving_review_count":0,"dismiss_stale_reviews":true}' \
  -F restrictions=null
```

`required_approving_review_count: 0` skips human review (you're solo); the status checks are the gate. `enforce_admins: false` lets you hotfix-merge if CI is broken. Bump to `1` + `enforce_admins: true` when you have collaborators.

**3. (Optional) Pin Node version + add CodeQL** — defensive static analysis. Free for public repos. ~5 min.

### Verification
- Open a test PR introducing a tsc error → `verify / backend` fails → merge button greys out.
- Fix the error → check turns green → can merge.
- Try pushing directly to `main` from CLI → blocked: "Required status check 'backend' is expected".

### Effort
~30 min.

---

## Issue 6 — API stack 500-resource ceiling (nested-stack split via cdk-import) 🔴

### What it is
The hardest item, and the one that unblocks several others. The API stack is at 496/500 resources. CloudFormation's hard limit is 500. The naive nested-stack split attempted earlier failed because CFN can't migrate physical resources between stacks (every route's `routeKey` is unique on the HTTP API; when CDK tried to CREATE the route in the new stack while the old stack still owned it, AWS returned `ConflictException: AlreadyExists`).

The proper fix uses `cdk import` — a flow that lets CDK adopt existing physical resources into new logical IDs in a new stack without re-creating them.

### Why it matters
Issues 1 (sub-processor endpoint), 4 (CSP report endpoint), and any future API route depend on this. Without it, every new feature is gated on the 500-resource ceiling.

### Current state
- ~89 API routes spread across the parent ApiStack.
- `RemovalPolicy.RETAIN` is already used in the codebase (DDB table, Cognito pool, S3 bucket, log group), so the team is familiar with the pattern.
- The previous nested-stack files exist in git history (commit `7b7d305`, reverted by `21a9999`). They're a useful starting reference even though they collided.

### Implementation plan — the cdk-import flow

Four phases:

**Phase A — Pre-flight: mark all routes RETAIN**

Modify the parent ApiStack's `addRoute()` helper to apply `RemovalPolicy.RETAIN` to the `HttpRoute`, `HttpIntegration`, and `Permission` constructs it creates. This way, the next time we deploy with routes *removed* from the parent stack, CFN will leave them orphaned in AWS instead of deleting them.

```diff
// Backend/lib/stacks/api.stack.ts in addRoute()
const route = this.httpApi.addRoutes({...});
+ route.forEach(r => r.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN));
+ fn.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
+ // (also: integration + permission — get hold via .node.findChild)
```

Deploy this single change. CFN will UPDATE the existing resources with the new retention policy. No collision. **This step is reversible and low-risk.**

**Phase B — Recreate the nested-stack structure with route definitions stubbed out**

Reintroduce the nested-stack files at `Backend/lib/stacks/api/{core,competitors,analytics-exports,integrations}.nested-stack.ts` (history at commit `7b7d305` is the starting point), but the route definitions inside them are stubbed/empty for this deploy. The parent stack still owns all routes.

Deploy. Result: parent stack has all routes (with RETAIN). Nested stacks exist but have ~0 routes each. No conflict.

**Phase C — Migrate routes in batches via `cdk import`**

For each route, the manual flow is:
1. Remove the route from the parent stack's `addRoute()` calls. It disappears from CFN's view but `RETAIN` keeps the physical resource alive in AWS.
2. Add the route's definition to the appropriate nested stack with a known logical ID.
3. Run `cdk import RivalScan-dev-Api-CoreRoutes` (interactive). CDK detects the new logical ID, asks for the existing physical resource ID, and imports it.
4. Verify no functional change at the live API.
5. Repeat for the next batch.

Realistically: split into 4 batches (one per nested stack), import each via CDK's interactive `cdk import` command. Each batch: ~10 routes × 3 resources × ~30 seconds of CDK interaction ≈ 15 min per batch.

**Phase D — Restore `/brand/setup`**

Once the nested-stack structure is in place and the resource budget reset (~100 resources of headroom per nested stack), re-add the `/brand/setup` route to `competitors.nested-stack.ts`. Deploy. `/brand/setup` flips from 404 → 401 in production.

### Verification (per phase)

- Phase A: `cdk diff` shows only `[~]` modifications adding `DeletionPolicy: Retain`. Deploy. Confirm via `aws cloudformation describe-stack-resources` that all routes still exist.
- Phase B: `cdk synth` succeeds. Nested stack JSONs are mostly empty. `cdk deploy` creates 4 empty nested stacks. Verify resource count BEFORE deploying — until Phase C the routes are still counted in the parent, so the parent might still be over 500.
- Phase C: each `cdk import` succeeds. `curl` against migrated routes still returns expected responses.
- Phase D: `curl /brand/setup` returns 401 (route exists), not 404.

### Effort
~2 sessions for the full flow. Phase A is ~30 min (fastest); Phase C is the bulk (~3–4 hours of careful work).

### Risks
- An incorrectly-typed logical ID during import → CDK can't match the existing resource. Mitigation: take very small batches.
- A typo in RETAIN policy → CFN deletes a route on the Phase B deploy. Mitigation: dry-run with `cdk synth` and check the template diff for any `DeletionPolicy: Delete` on routes before deploying.
- A failed import mid-batch leaves the nested stack in `IMPORT_IN_PROGRESS` state. Recovery: `aws cloudformation continue-update-rollback` or manually delete the half-imported stack and retry.

This is the single most consequential item on this list.

---

## Issue 7 — Monthly cost cap latency 🟡

### What it is
The per-user monthly Anthropic cost cap (`PLAN_LIMITS[tier].monthlyCostCap`) is checked against `user.monthToDateCostUsd`, which is updated **nightly by the `aggregate-ai-costs` Lambda** at 3am UTC from CloudWatch Logs Insights.

So between the moment the user crosses their cap and the cap actually firing, there's up to 24 hours of "free" overspend. A runaway loop could burn substantial budget in that window.

### Why it matters
At pre-launch scale this is fine. At public-signup scale, a single misconfigured user or a hostile signup could drain weeks of monthly margin in one day.

### Current state
- `Backend/src/functions/scheduled/aggregate-ai-costs.ts:234-286` writes `monthToDateCostUsd` nightly.
- `Backend/src/shared/utils/research-eligibility.ts:130-159` reads this cached value at every research trigger.
- The real-time **per-user daily** rate limit (`researchPerDay`) catches single-user runaways within a 24-hour window even if cost-cap doesn't fire.

### Implementation plan

**Approach A — Real-time increment in `callAnthropic`** (recommended)

In `Backend/src/shared/services/anthropic.ts`, at the end of every successful `callAnthropic` call, fire-and-forget update the user's `monthToDateCostUsd` directly:

```typescript
if (input.userId && costUsd > 0) {
  void updateItem(userPK(input.userId), userSK(), {
    monthToDateCostUsd: { Action: 'ADD', Value: costUsd },
    monthToDateCostMonth: nowYYYYMM,
    lastAiCallAt: now,
  }).catch((err) => {
    logger.warn('cost_cache_update_failed', { err: err.message });
  });
}
```

DDB's `ADD` action is atomic. Race conditions across concurrent calls converge correctly. The nightly aggregator becomes a *reconciliation* job (corrects any drift from missed updates), not the source of truth.

**Approach B — Step Function input throttle**

Add a pre-research check that estimates cost (input tokens × price) and rejects if the user's MTD spend plus the estimate exceeds the cap. Less accurate (estimates are wrong) but doesn't require updating the User row on every Anthropic call.

Recommend Approach A. Standard write-side fix that matches the read-side check.

### Verification
- Manually call a Claude-using endpoint as a low-tier user → MTD cost ticks up immediately in DDB.
- Verify the nightly aggregator still runs and corrects any drift.
- Set a low test cap → confirm the cap fires within seconds of crossing it, not 24 hours.

### Effort
~30 min for Approach A.

---

## Issue 8 — Anthropic rate-limit handling 🟡

### What it is
Anthropic has a 30k input-tokens-per-minute org-level rate limit. CLAUDE.md notes the `MapResearch` state machine sets `maxConcurrency: 1` to avoid pile-ups during onboarding. But cross-user concurrency is unbounded — a spike of new signups all kicking off onboarding research at once could trip the limit.

### Why it matters
When the limit trips, every in-flight `callAnthropic` returns 429. `callAnthropic` already has retry/backoff (honors `retry-after`, max 2 retries) which masks short blips. A sustained spike longer than the backoff window cascades into actual research failures.

### Current state
- `callAnthropic` at `Backend/src/shared/services/anthropic.ts` handles 429 with backoff.
- No app-level token bucket or rate limiter exists.

### Implementation plan

**DynamoDB-backed token bucket**

Add a `RateLimit` entity:

```
PK = RATELIMIT#ANTHROPIC_INPUT_TPM
SK = MINUTE#<YYYY-MM-DDTHH:MM>
Fields: tokensUsed (atomic ADD)
```

In `callAnthropic`, before the fetch:

```typescript
const minuteKey = new Date().toISOString().slice(0, 16);
const ttl = Math.floor(Date.now()/1000) + 120;
await updateItem(
  'RATELIMIT#ANTHROPIC_INPUT_TPM',
  `MINUTE#${minuteKey}`,
  {
    tokensUsed: { Action: 'ADD', Value: estimatedInputTokens },
    expiresAt: ttl,
  }
);
const current = await getItem(...);
if (current.tokensUsed > 25_000) {
  // 5k headroom under the 30k limit
  await sleep(60_000 - (Date.now() % 60_000));
  // retry the rate-limit check
}
```

The window self-rotates per-minute; DDB TTL handles cleanup.

### Verification
- Synthetic load test: trigger 20 concurrent research runs across 20 fake users → confirm `callAnthropic` queues/backs off before hitting Anthropic's 429.
- Monitor `ai_call_completed` log lines for retry counts going down.

### Effort
~1 session. The token-estimation logic needs a simple character-based heuristic (1 token ≈ 4 chars).

---

## Issue 9 — AI audit log completeness 🟡

### What it is
COMPLIANCE Phase 1.5 mandates: every Claude response stored with timestamp, competitor, user for **defamation defense**. Today's `ai_call_completed` log line has `aiCallId`, `promptHash`, `costUsd` — cost-centric. **The actual response text isn't logged anywhere**, which means if someone claims RivalScan's AI defamed them, there's no forensic record of what was generated.

### Why it matters
This is real legal exposure once the product has paying users. The COMPLIANCE roadmap calls this out explicitly. Untreated, the first defamation claim is undefended.

### Current state
- `Backend/src/shared/services/anthropic.ts:227-241`: structured log line with hashes + costs but no response body.
- `ResearchFinding`, `Change`, etc. store the *processed* output. The *raw* response is gone after the Lambda returns.

### Implementation plan

**1. New DynamoDB entity** — `AILog`

```
PK = AILOG#<YYYY-MM>
SK = CALL#<ISO timestamp>#<aiCallId>
Fields: aiCallId, opName, model, userId, competitorId?,
        promptHash, responseTextTruncated (first 4096 chars),
        status, durationMs, inputTokens, outputTokens, costUsd, expiresAt
```

Monthly bucketed PK for cheap scans; 1-year TTL via `expiresAt`.

**2. Write at the end of `callAnthropic`** — fire-and-forget; never blocks the response.

```typescript
const responseText = await responseClone.text();
void putItem({
  PK: `AILOG#${now.slice(0,7)}`,
  SK: `CALL#${now}#${aiCallId}`,
  ...
  responseTextTruncated: responseText.slice(0, 4096),
  expiresAt: Math.floor(Date.now()/1000) + 365*86400,
}).catch((err) => logger.warn('ailog_write_failed', { aiCallId, err: err.message }));
```

**3. Cost** — DDB writes are ~$0.0000025 each. At ~1000 calls/day = ~$0.0025/day = $1/year. Storage: ~4kb × 1000/day × 365 = ~1.5 GB/year × $0.25/GB = $0.40/year. Negligible.

### Verification
- After any Claude call, query the table: `aws dynamodb query --key-condition-expression "PK = :p" --expression-attribute-values '{":p":{"S":"AILOG#2026-06"}}'` → row exists with truncated response text.
- Defamation drill: pick a Claude-generated battlecard, query the AILog by `aiCallId` (on the Change record), confirm we can reconstruct the original response.

### Effort
~30 min.

---

## Issue 10 — Capabilities matrix consolidation 🔵

### What it is
`Backend/src/shared/types/capabilities.ts` and `Frontend/src/lib/utils/capabilities.ts` are duplicated by hand. When you add a flag (e.g. `audioBriefing` recently), you must update both files. Drift risk is real and there's no automated check.

### Why it matters
A flag added on the backend but not on the frontend means the frontend can't gate UI on it. Silent UX failure.

### Implementation plan

**Generate the frontend file from the backend**

`Backend/scripts/generate-frontend-capabilities.ts`:

```typescript
import { writeFileSync } from 'fs';
import { CAPABILITIES } from '../src/shared/types/capabilities';

const out = `// AUTO-GENERATED by Backend/scripts/generate-frontend-capabilities.ts
// Do not edit by hand. Regenerate via: cd Backend && npx ts-node scripts/generate-frontend-capabilities.ts

import type { PlanTier } from "@/lib/types";

export interface Capabilities ${/* shape derived from CAPABILITIES.scout */ ''}{}

export const CAPABILITIES: Record<PlanTier, Capabilities> = ${JSON.stringify(CAPABILITIES, null, 2)};

export function capabilitiesFor(user: { plan?: PlanTier } | null | undefined): Capabilities {
  return CAPABILITIES[user?.plan ?? "scout"];
}
`;

writeFileSync('../Frontend/src/lib/utils/capabilities.ts', out);
```

Add a CI step in `verify.yml` that runs the generator and fails if the output diff is non-empty (means the dev forgot to regen).

### Verification
- Add a new flag to backend `Capabilities` interface → run the script → frontend file regenerated correctly.
- Skip the script → CI step fails with "regenerate the frontend capabilities mirror".

### Effort
~45 min.

---

## Issue 11 — Phase numbering unification 🔵

### What it is
`ROADMAP.md` uses Phases 0–5. `PRODUCT_GAPS_ROADMAP.md` uses Phases 1–11. `COMPLIANCE_ROADMAP.md` uses Phases 1–7. CLAUDE.md sprinkles references to "Phase 22 (research-runs)", "Phase 23 (Brand Pulse)", "Phase 24 (comparative analytics)" which don't appear in any of those three roadmap docs.

Future readers can't easily map a code reference to a roadmap phase.

### Implementation plan

**Master timeline at the top of CLAUDE.md**

```
## Master phase timeline

| # | Phase | Lives in |
|---|---|---|
| 0 | Research prompt enrichment | docs/roadmaps/ROADMAP.md |
| 1 | Pipeline continuity | docs/roadmaps/PRODUCT_GAPS_ROADMAP.md |
| ...
| 23 | Brand Pulse | (this doc — iterative on existing infra) |
| 24 | Comparative analytics | (this doc) |
```

### Effort
~30 min.

---

## Recommended sequence

| # | Item | Effort | Unblocks |
|---|---|---|---|
| 1 | **Issue 6** — nested-stack refactor (cdk import flow) | ~2 sessions | Issues 1, 4 + any future API route |
| 2 | **Issue 5** — CI workflow + branch protection | ~30 min | (independent — do anytime) |
| 3 | **Issue 2** — cookie banner | ~15 min | (independent) |
| 4 | **Issue 4** — CSP report-uri | ~30 min | (depends on Issue 6) |
| 5 | **Issue 1** — sub-processor subscription endpoint | ~1 session | (depends on Issue 6) |
| 6 | **Issue 3** — WAF + CloudFront fronting | ~1.5 sessions | Real security posture for launch |
| 7 | **Issue 7** — real-time cost-cap update | ~30 min | (independent) |
| 8 | **Issue 9** — full AI audit log | ~30 min | (independent) |
| 9 | **Issue 8** — Anthropic rate-limit bucket | ~1 session | (only if load testing shows the issue) |
| 10 | **Issue 10** — capabilities matrix codegen | ~45 min | (anytime) |
| 11 | **Issue 11** — phase-numbering master timeline | ~30 min | (anytime) |

**Engineering-only total**: ~6–8 sessions ≈ 1–2 weeks calendar.

**Non-programmatic dependencies** (block public launch but not in this doc):

- Lawyer engagement to finalize `<DraftBanner>` text on Privacy / Terms / DPA pages
- DPIA writeup (GDPR Art. 35) — requires both engineering input + legal review
- SOC 2 Type II audit program (for enterprise sales, not public launch)
- Cyber liability insurance underwriting

---

## Verification across all items

After landing all 11 programmatic items:

```bash
# Backend
cd Backend && npx tsc --noEmit && npx vitest run && npx cdk synth --quiet
# Frontend
cd Frontend && npx tsc --noEmit && npm run lint
# CFN resource count (now per nested stack; each should be under 500)
```

Plus a manual smoke pass for each new surface (cookie banner appears, sub-processor form submits, WAF logs blocked attempts, CSP violations log to CloudWatch, the time-machine slider still works after the nested-stack split).
