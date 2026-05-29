# Secret Rotation Runbook

> Phase 9b. Companion to [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md). Quarterly rotation cadence; emergency procedure documented at the bottom.

## Inventory

All application secrets live in **AWS Secrets Manager** under the `rivalscan/api-keys` secret. The Lambda runtime fetches them lazily via `Backend/src/shared/services/secrets.ts`, which caches each fetch for 5 minutes per Lambda instance.

| Secret key | Provider | Rotation cadence | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com | Quarterly | Used by every AI helper in `anthropic.ts`. |
| `PADDLE_SECRET_KEY` | vendors.paddle.com | Quarterly | Used by `paddle.ts` for checkout-session signing. |
| `PADDLE_WEBHOOK_SECRET` | vendors.paddle.com | Quarterly | Verifies inbound webhook signatures. |

Cognito user-pool client secrets are managed by Cognito itself and rotated automatically.

## Rotation cadence

- **Application secrets:** every 90 days (quarterly). Use the `lastRotatedAt` audit log at the bottom of this file to confirm timing.
- **Cognito secrets:** Cognito-managed; no manual action required.
- **Calendar reminder:** put a recurring 90-day event labeled "Rotate API secrets" on the owner's calendar with a link to this doc.

## Rotation procedure (per secret)

The procedure is identical for `ANTHROPIC_API_KEY`, `PADDLE_SECRET_KEY`, `PADDLE_WEBHOOK_SECRET` — only the provider console differs.

1. **Generate the new secret at the provider.**
   - Anthropic: console.anthropic.com → Settings → API Keys → Create Key. Name it with the rotation date (e.g. `rivalscan-2026-q2`).
   - Paddle: vendors.paddle.com → Developer Tools → Authentication. Generate new key.
   - **Don't revoke the old key yet** — there's a brief window where both must be valid.

2. **Update AWS Secrets Manager.**

   ```bash
   aws secretsmanager get-secret-value --secret-id rivalscan/api-keys --query SecretString --output text > /tmp/secret.json
   # Edit /tmp/secret.json — update the relevant key with the new value
   aws secretsmanager update-secret --secret-id rivalscan/api-keys --secret-string file:///tmp/secret.json
   rm /tmp/secret.json    # IMPORTANT: never leave plaintext secrets on disk
   ```

   Or via console: AWS Console → Secrets Manager → `rivalscan/api-keys` → Retrieve secret value → Edit.

3. **Wait 5 minutes.** Lambda's in-memory cache (`Backend/src/shared/services/secrets.ts`, 5-minute TTL) flushes lazily. New invocations will pick up the new value automatically. No redeploy needed.

4. **Verify the new key works.**
   - **ANTHROPIC_API_KEY:** trigger a "Research Now" on a test competitor. Watch CloudWatch logs for `ai_call_completed` with `status: 'ok'`.
   - **PADDLE_SECRET_KEY:** create a test checkout session via the dashboard's upgrade flow.
   - **PADDLE_WEBHOOK_SECRET:** trigger a Paddle test webhook from the Paddle console; confirm the API responds 200 (not 400 INVALID_SIGNATURE).

5. **Revoke the old key at the provider.**
   - Anthropic: console.anthropic.com → API Keys → click the old key → Revoke.
   - Paddle: vendors.paddle.com → rotate completes the revocation automatically when you create the new one. Confirm the old key is no longer listed.

6. **Update the audit log** at the bottom of this file.

## Emergency rotation (suspected leak)

If you suspect a secret is leaked (committed to git, posted in a screenshot, copied to a customer ticket, etc.):

1. **Don't push the new secret to git.** Even via env var. Generate at the provider, paste directly into AWS Secrets Manager.
2. **Revoke first, regenerate second** — opposite order from quarterly rotation. Cuts off the attacker before fixing your service. Brief 1-2 minute outage during the swap is acceptable.
3. **Audit usage.** For Anthropic: check the [usage dashboard](https://console.anthropic.com/settings/usage) for spikes. For Paddle: check the [transactions log](https://vendors.paddle.com/transactions). For both, take the timestamp of the suspected leak and look for unusual API calls in the 24 hours after.
4. **CloudTrail check.** Search the audit-logs bucket (Phase 9b) for any unusual access patterns to Secrets Manager during the leak window:
   ```
   aws s3 ls s3://rivalscan-dev-audit-logs/AWSLogs/<account>/CloudTrail/
   # download the day's logs, grep for GetSecretValue against rivalscan/api-keys
   ```
5. **Communications.** If customer data was at risk via the leak, follow [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md) → "Customer data breach" playbook. GDPR Art. 33 requires notification within 72 hours of becoming aware.
6. **Post-mortem.** Write up how it leaked + the prevention plan within 7 days. File under `incidents/YYYY-MM-DD-secret-leak.md`.

## Audit log

| Date | Secret | Person | Method | Notes |
|---|---|---|---|---|
| 2026-05-29 | `FIRECRAWL_API_KEY` | owner | console | Removed — legacy from pre-deep-research era, never referenced by current code. |
| 2026-04-30 | (initial deploy) | owner | console | First-time provisioning, Phase 1 compliance work. |

Append rows above this line, newest first. Every quarterly + emergency rotation logs here.
