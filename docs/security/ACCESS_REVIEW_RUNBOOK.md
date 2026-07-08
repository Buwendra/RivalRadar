# Access Review Runbook

> Phase 10a. Quarterly procedure to verify who has privileged access to Kironyx's systems. Companion to [SECRET_ROTATION_RUNBOOK.md](../runbooks/SECRET_ROTATION_RUNBOOK.md) (paired cadence). Maps to SOC 2 CC6.2 (provisioning + de-provisioning) and CC6.3 (access modifications).

## Cadence

- **Quarterly review:** every 90 days. Pair with the secret-rotation cadence — same calendar event.
- **Off-cycle review (mandatory):**
  - Anyone with system access leaves the organization.
  - Suspected credential leak (e.g. a key shows up in a public commit).
  - After a SEV1 or SEV2 incident.
  - On security questionnaire request from a customer.

## Per-system review table

For each row: open the listed source, verify the "Who today" column, take action if anyone listed should no longer have access, and log the review (date, reviewer, findings, actions) in `ACCESS_REVIEW_LOG.md` (kept private; not committed to git).

| # | System | What to review | Who today | Action if no longer needed |
|---|---|---|---|---|
| 1 | **AWS root account** | Root login enabled? Hardware MFA still in place? Last-used date? | Owner only | Rotate root password; never delete the root identity. Disable any non-MFA console session. |
| 2 | **AWS IAM users** | `aws iam list-users` then `aws iam get-credential-report`. Inspect `password_last_used`, `access_key_1_last_used_date`, `mfa_active`. | Owner; CI/CD service user (if any) | Disable any user inactive 90+ days. Rotate access keys older than 90 days. Delete users for departed contractors. |
| 3 | **AWS IAM roles** | `aws iam list-roles` — sanity-check no roles trust an unexpected principal. | Lambda execution roles + CDK-managed roles only | Investigate any role with an external trust policy. |
| 4 | **GitHub repo admins / collaborators** | `gh api repos/<org>/<repo>/collaborators --jq '.[].login'` | Owner | Revoke former contributors. Verify branch-protection rules still require PR review on `main`. |
| 5 | **GitHub Actions secrets** | Repo Settings → Secrets and variables → Actions. Check creation/last-updated dates. | Per current `.github/workflows/*.yml` requirements | Delete unused secrets. Rotate any older than 90 days. |
| 6 | **Cognito user pool** | Console → User pool `Kironyx-${stage}-Auth` → Users tab. Sort by last-used. | All registered customers (sign-ups). Internal staff accounts. | This is the customer base — only review for unexpected staff accounts or test fixtures that shouldn't persist. |
| 7 | **Paddle dashboard** | Console → Settings → Team. | Owner | Rotate the Paddle webhook secret if anyone leaves; revoke their dashboard access. |
| 8 | **Anthropic console** | console.anthropic.com → Manage org members. | Owner | Rotate the Anthropic API key if anyone leaves; remove their org membership. |
| 9 | **Amplify console** | App settings → Access. | Owner | Revoke any unexpected member. |
| 10 | **AWS Amplify environment variables** | Amplify console → App `d1zrq9gf129s9u` → Hosting → Environment variables. | Per build needs (NEXT_PUBLIC_* only) | Delete any stale variable that no longer maps to the running frontend. |
| 11 | **Domain registrar** | Registrar account login + 2FA enabled? DNS records still pointing where expected? | Owner | Add 2FA if missing. Rotate registrar password annually regardless. |
| 12 | **AWS Secrets Manager** | `aws secretsmanager list-secrets --query 'SecretList[].{Name:Name,LastRotated:LastRotatedDate}'` | `kironyx/api-keys`, plus any per-stage variants | Cross-check against `SECRET_ROTATION_RUNBOOK.md` rotation log. Anything unrotated >120 days = action item. |
| 13 | **API keys (in-app)** | Sign in as workspace owner → Settings → Workspace → API keys. Or query DynamoDB directly: `PK begins_with APIKEY#`. | Per-customer, per-workspace | Customers self-manage. Internal staff should not have personal API keys for production accounts. |

## Procedure

1. **Block 30 minutes** on the calendar (paired with secret-rotation review).
2. **Run** `bash Backend/scripts/soc2-evidence-snapshot.sh` to refresh the evidence baseline. The output folder gives you `iam-users.json`, `iam-credential-report.csv`, `secrets-inventory.json` etc. without manual console clicks.
3. **Walk the table** in order. For each row, capture in `ACCESS_REVIEW_LOG.md`:
   - **Date of review**
   - **Reviewer**
   - **Source consulted** (CLI command output, console screenshot, etc.)
   - **Findings** ("expected state confirmed" / "anomaly: X")
   - **Actions taken** ("rotated key for service-user", "disabled IAM user xyz")
4. **Take action immediately** on any anomaly — don't defer access revocation. Past-90-day inactive credentials get disabled the same hour.
5. **Update** the `Last reviewed:` date at the bottom of this file.
6. **Calendar the next review** (same event repeats every 90 days).

## What to do if anomalies are found

| Anomaly | Action |
|---|---|
| IAM user with active access keys but no MFA | Disable console access immediately; rotate keys; investigate why MFA was disabled. |
| Access key not used in 90+ days | Disable. If business owner confirms still needed, rotate + restart the 90-day window. |
| Unknown collaborator on the GitHub repo | Investigate immediately. Revoke. Audit recent commits for tampering via `git log --since=90.days.ago`. |
| Unknown member in Paddle / Anthropic console | Treat as potential credential leak. Revoke + rotate the API key/webhook secret + run the [INCIDENT_RUNBOOK.md](../runbooks/INCIDENT_RUNBOOK.md) "Credential leak" playbook. |
| Secret unrotated >120 days | Trigger the rotation procedure ([SECRET_ROTATION_RUNBOOK.md](../runbooks/SECRET_ROTATION_RUNBOOK.md)) on the next business day. |
| Customer-facing API key dormant for 12+ months | No action — this is customer state. (Future enhancement: notify the workspace owner.) |

## Audit log table

A running history at the bottom of this file. New row each quarter.

| Date | Reviewer | Findings | Actions |
|---|---|---|---|
| _(template)_ | _(name)_ | _(brief)_ | _(brief)_ |

---

Last reviewed: **2026-05-07** by the workspace owner.
Next review due: **2026-08-05**.
