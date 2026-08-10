# Kironyx Live Functional Test Report — 2026-08-09

Target: **dev** stage · Frontend `https://main.d1zrq9gf129s9u.amplifyapp.com` · API `https://6xjghxskzd.execute-api.us-east-1.amazonaws.com` · AWS account `076561717141` / us-east-1.

## Executive summary

A full functional test was run against the **live dev system**. The **entire public web surface and the black-box API layer passed and are healthy.** The most important result is a **deployment-drift defect: self-signup is wide open on the live API** even though the product is meant to be invite-only.

The authenticated, AWS-side, email, and destructive portions could **not** be completed — two environmental blockers stopped them (see Blockers). Roughly 25% of the planned campaign ran; ~75% is blocked pending access only the account owner can provide.

| Verdict | Count |
|---|---|
| ✅ PASS | 24 checks (9 API negative/gating, 15 web-surface) |
| 🔴 DEFECT | 2 (open signup, resend 500) |
| ⛔ BLOCKED | ~60 authenticated routes + all AWS/email/destructive flows |

---

## 🔴 Defects found

### D1 — Self-signup is OPEN on the live API (High / security + cost)

`POST /auth/signup` returns **201 and creates a real Cognito user + DynamoDB profile**. Current source (`Backend/src/functions/api/auth/signup.ts:30`) should return `403 SIGNUP_DISABLED`, and Cognito should have `selfSignUpEnabled: false`. Both gates are absent live — two accounts were created through the public endpoint, and a follow-up sign-in returned `403 UNCONFIRMED` (proving the Cognito user really exists).

**Root cause:** the deployed backend predates commit `5cddadd` (July 23 2026 lockdown). The **frontend is current** (all CTAs route to `/contact`, `/sign-up` shows the "sign-ups closed" card), but the **CDK backend was never redeployed** after that commit — Amplify auto-deploys on push, CDK does not. So the funnel looks invite-only to users while the API is open.

**Impact:** anyone hitting the API directly can create accounts, and each account can trigger paid Anthropic research (~$0.30–0.60/run) → an unmetered cost/abuse vector. The durable auth rate-limiting and the tightened 20 req/s stage throttle from the same commit are also not live.

**Fix:** redeploy the backend — `cdk deploy Kironyx-dev-Auth Kironyx-dev-Api` (after `set -a && source .env && set +a`, with `SIGNUP_ENABLED` unset). Run `/deploy-preflight` first.

### D2 — `POST /auth/resend-verification` returns 500 (Medium)

A normal resend request returned `500 INTERNAL_ERROR` rather than a handled response. This is the old (pre-lockdown) in-memory handler. It may be Cognito email throttling surfacing as an unhandled error, but a public endpoint returning a raw 500 is a defect regardless. The current handler (`Backend/src/functions/api/auth/resend-verification.ts`) handles these paths gracefully — the same redeploy fixes it.

---

## ✅ What passed

### Unauthenticated / negative API (Phase 1)

All behaved correctly except D1:

| Test | Result |
|---|---|
| No / garbage JWT on `/users/me` | 401 ✓ |
| `POST /auth/signup` (expected 403) | **201 — see D1** ✗ |
| Malformed signin body | 400 `VALIDATION_ERROR` ✓ |
| Bad public battlecard token | 404 `NOT_FOUND` ✓ |
| Bad cancellation-feedback token | 400 `VALIDATION_ERROR` (schema validated before token lookup) ✓ |
| Unsigned Paddle webhook | 400 `MISSING_SIGNATURE` ✓ (signature enforced) |
| `/v1/*` without `X-API-Key` | 401 `MISSING_API_KEY` ✓ |
| Unknown route | 404 ✓ |
| Route-existence probe (`brand/health`, `analytics/share-of-voice`, `admin/business`, `research-runs`, `competitors/matrix`, `notifications`, `saved-views`, `battlecards`, `integrations`, `v1/changes`, `v1/recommendations`) | all 401 = routes deployed ✓ |

### Public web surface (Playwright — all 200, zero console errors/warnings)

- **Home** — signal-field canvas rendering (1905×1358), correct H1 ("Your brand and your rivals, seen through one lens."), all 7 hero/nav CTAs → `/contact`.
- **Pricing** — Scout/Strategist/Command at $49/$99/$199, all correct.
- **`/sign-up`** — correctly shows the closed "sign-ups by invitation" card, no password field (frontend funnel closed — the mirror image of D1).
- **`/contact`** — "Request access" form (name/company/email/note) + `support@ / security@ / privacy@ / legal@kironyx.com` mailto links.
- **`/dashboard` unauthenticated** — AuthGuard redirects to `/sign-in?redirect=%2Fdashboard` ✓.
- **product, about, security, sample-report, both `/compare/*` (Klue content present, 70 KB page), all 5 `/legal/*`, sign-in, bad-token invite/cancellation pages** — all 200, render content.

---

## ⛔ Blockers

### B1 — No AWS credentials for account 076561717141

The default CLI profile fails `sts get-caller-identity` (`InvalidClientTokenId`); the other profiles are Bloom accounts (450023184671, 842345351770) / `invoice` (905418147666), and the SSO profiles are expired. This blocks admin-create-user, all DynamoDB inspection, Step Functions triggers/describe, CloudWatch logs, SES checks, alarms, the StatusPage URL, and cleanup.

**Fix:** `aws sso login` for the right profile, or set valid keys for the Kironyx account.

### B2 — No authenticated session obtainable autonomously

Self-signup works but sign-in needs email confirmation (`403 UNCONFIRMED`), and the inbox can't be read to get the code (Gmail connector not authorized in the test session). Real-account testing needs the owner present to type the password in the browser.

**Fix (any one):** (a) `aws sso login` so a throwaway can be admin-confirmed; (b) supply the confirmation code emailed to `buwendra.s+kxtest0809@gmail.com`; (c) be available to type the real-account password in the Playwright browser.

### Consequently NOT tested

Onboarding + research pipeline (AI spend), competitors CRUD/battlecard/snooze/bulk-import/matrix, brand & analytics, changes/recommendations/notifications, saved views, workspaces/invites/roles/audit, API keys + `/v1` scopes, exports (PDF/CSV), subscriptions/Paddle, admin/business, all GDPR/destructive flows, email deliveries, and all dashboard pages.

---

## 🧹 Cleanup required

The test created two unconfirmed accounts that could not be removed without AWS access (a live consequence of D1):

- `qa-signup-test@example.com` — userId `01KZJMGB0F1CNH2D7WWW0KBYTH`
- `buwendra.s+kxtest0809@gmail.com` — userId `01KZJPCJ5HEFKG6YF2V9HHPN4D`

Each has a Cognito user + a `USER#<id> / PROFILE` DynamoDB row. Once authenticated: `aws cognito-idp admin-delete-user` for each, plus delete the two DDB rows from `Kironyx-dev-Database-Table`.

---

## How to unblock the rest

The full test plan is saved locally and is ready to execute once access is sorted. **Most efficient path:** `aws sso login` for the Kironyx account (fixes B1 and B2 at once — a throwaway user can then be created/confirmed, the whole authenticated + AWS + email + destructive campaign can run, and the residue accounts cleaned up automatically). Alternatively, authenticated API + dashboard testing can run against the real account with the owner present to type the password once — but that still leaves the AWS-side verification (Step Functions, CloudWatch, DynamoDB, SES, alarms) untestable.

---

## Coverage gaps (would remain out of scope even when unblocked)

- Paddle purchase completion (real money) and signed-webhook happy path.
- Scheduled crons firing on their own schedule (only manual triggers are feasible).
- SES production sending mode and the `kironyx.com` custom domain (not live yet).
- Workspace ownership-transfer positive path and the open-signup path (`SIGNUP_ENABLED=true`).
- Slack/webhook integration delivery to real endpoints; load testing beyond throttle sanity.
