# Change Management Policy

> Phase 10a. Documents the de-facto deploy procedure for production changes. Maps to SOC 2 CC8.1 (changes to system components) and ISO 27001 A.12.1.2 (change management).

## Scope

This policy covers any change to the production Kironyx environment that customers can be affected by:

- Code changes (Backend Lambdas, Frontend Next.js, CDK infrastructure).
- Configuration changes (environment variables, AWS Secrets Manager values, Cognito user pool settings).
- IAM changes (new policies, new users, new role trust relationships).
- Schema changes (DynamoDB attributes, GSI additions).
- Third-party integration changes (Paddle webhook URLs, SES sending domain, etc.).

It does **not** cover dev-only experimentation, local-only changes, or documentation-only changes (those don't affect production).

## Standard change procedure

Every production-affecting change goes through the following gates:

1. **GitHub PR.** No direct pushes to `main`. Branch-protection on `main` enforces this at the platform level.
2. **PR review.** Solo-founder operation today: a self-review walk-through with the explicit checklist (below) serves as the review. When a second engineer joins, this becomes a peer review.
3. **CI gates pass:**
   - Backend `npx tsc --noEmit` clean.
   - Frontend `npx tsc --noEmit` clean.
   - Frontend `npm run lint` clean.
   - Backend `npx cdk synth --quiet` clean.
   - `npm audit --audit-level=high` clean (Phase 9b workflow `.github/workflows/npm-audit.yml`).
4. **Merge to `main`.**
5. **Deploy:**
   - **Backend:** `cd Backend && set -a && source .env && set +a && npx cdk deploy --all` from the operator's MFA-enabled local environment. Specific stacks: `cdk deploy Kironyx-${stage}-Pipeline Kironyx-${stage}-Api`.
   - **Frontend:** automatic via Amplify on push to `main`. Manual: `aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE`.
6. **Smoke-test:** sign in to the deployed environment, exercise the changed surface, verify CloudWatch shows no new errors, verify the Phase 8c status page transitions stayed green.

## PR review checklist

For each PR, the reviewer (or self-reviewing author) confirms:

- [ ] **Behavior change is intentional and described in the PR body.**
- [ ] **No secrets in the diff** (API keys, passwords, customer data).
- [ ] **Schema changes are backwards-compatible** OR a migration plan is documented in the PR body.
- [ ] **IAM changes follow least-privilege** (no `*:*` policies, no resource wildcards beyond what's necessary).
- [ ] **Tests pass** (where present).
- [ ] **Type-checks pass** for both Backend and Frontend.
- [ ] **CDK synth produces a clean diff** (`cdk diff` shows expected resource changes only).
- [ ] **Logging is adequate** for the new surface (every meaningful event emits a `logger.info` line).
- [ ] **Audit emission added** for owner-mutating actions per Phase 4b.
- [ ] **Tier gating reviewed** for capability-gated features.

## High-risk change checklist

Some changes carry extra blast radius. For these, require additional steps:

| Change category | Extra precaution |
|---|---|
| **DynamoDB schema migration** | Pre-deploy: confirm DynamoDB Point-in-Time Recovery is enabled on the table (`aws dynamodb describe-continuous-backups`). Plan a rollback by reverting the schema-affecting code change; data already written under new shape stays — that's the cost of a bad migration. |
| **IAM policy changes** | Test in dev stage first. Confirm the new policy ID exists. Verify least-privilege via `iam simulate-principal-policy`. |
| **Payment-flow edits** | Test the full Paddle checkout → webhook → subscription update path in the dev stage with a Paddle sandbox account. |
| **Secret rotations** | Follow [SECRET_ROTATION_RUNBOOK.md](../runbooks/SECRET_ROTATION_RUNBOOK.md). Rotate in low-traffic windows when possible. |
| **CDK stack additions** | Verify cross-stack dependency graph is acyclic via `cdk synth --quiet` before merge. |
| **Cognito user pool changes** | Schema-affecting changes (custom attributes) cannot be removed once added. Verify the change is genuinely needed. |
| **Frontend public-facing copy** | Cross-check legal pages for compliance language consistency. Privacy Policy / ToS edits should land with `tosVersion` / `privacyVersion` bump (Phase 9a re-consent banner). |

## Rollback procedure

CDK ships immutable Lambda function versions; rollback is possible without re-deploying CDK if the regression is in code.

1. **Backend code regression** — revert the offending commit on `main` and redeploy the Api stack (`npx cdk deploy Kironyx-<stage>-Api`). Function names are `Kironyx-<stage>-Api-<FnId>` (the FnId → route map is `Backend/src/functions/route-manifest.ts`); note the stacks publish no Lambda aliases, so alias-flip rollback is not available, and API functions are **domain-grouped** — any rollback of one function reverts every route it serves.
2. **Backend infrastructure regression** — revert the offending commit on `main`, redeploy via `cdk deploy --all`.
3. **Frontend regression** — Amplify deploy history: `aws amplify list-jobs --app-id d1zrq9gf129s9u --branch-name main`. Re-deploy a previous build: `aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type REDEPLOY --job-id <prior-job-id>`.
4. **Configuration regression** — restore prior values in AWS Secrets Manager (`aws secretsmanager update-secret`). Invalidate the in-Lambda 5-minute secrets cache by triggering a cold start (touch any environment variable on the Lambda).
5. **Document the rollback** in `INCIDENT_RUNBOOK.md` post-incident review template if the rollback was triggered by a customer-affecting incident.

## Emergency change procedure

When a SEV1 incident requires an immediate fix and the standard PR-review-then-merge flow would prolong the incident:

1. **Push the fix directly** to `main` (the branch-protection rule can be temporarily lifted by the owner, or the fix can be made via a PR with a single approver = the same person who wrote it).
2. **Deploy** via the standard procedure.
3. **Within 24 hours**, file a "PR of record" documenting:
   - What was changed and why.
   - Why the standard procedure was waived.
   - What follow-up tests / observations confirm the fix.
4. **Treat the emergency change as a SEV-trigger** for the access-review off-cycle workflow if any IAM or secrets change was involved.

## Audit evidence

Every production-affecting change is auditable via:

- **GitHub commit history** on `main` — every change has a commit hash, author, timestamp, and PR link.
- **GitHub Actions logs** — CI gate evidence retained for 90 days by default.
- **CloudTrail** — every AWS API call (including `cloudformation:UpdateStack` from CDK deploys) is recorded for 7 years (Phase 9b).
- **Amplify deploy logs** — frontend deploy history retained per Amplify's default policy.

A SOC 2 auditor wanting "evidence that changes go through review" can be pointed at `gh pr list --state merged --limit 50` plus the corresponding CI run logs.

## Review

This policy is reviewed annually OR on any of: incident with a CHANGE_MANAGEMENT root cause, headcount change requiring a different review model, new compliance requirement.

Last reviewed: **2026-05-07** by the workspace owner.
Next review due: **2027-05-07**.
