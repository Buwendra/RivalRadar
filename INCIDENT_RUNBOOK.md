# Incident Runbook

> Phase 9b. Companion to [SECRET_ROTATION_RUNBOOK.md](SECRET_ROTATION_RUNBOOK.md). Reviewed quarterly alongside the secret rotation cadence.

## Severity definitions

| Severity | Description | Response time | Examples |
|---|---|---|---|
| **SEV1** | Production down or customer data at risk | Immediate (within 15 min) | API totally unreachable; suspected data breach; AWS account takeover. |
| **SEV2** | Major feature broken; some customers affected | Within 1 hour | Research pipeline failing for >50% of users; weekly digest didn't send; payment-flow broken. |
| **SEV3** | Minor feature broken; workaround exists | Within 1 business day | Slack integration intermittently failing; one cron silently dropped a single execution. |
| **SEV4** | Cosmetic / non-customer-impacting | Best-effort | Dashboard layout regression on Safari; alarm tuning; doc fixes. |

## On-call

Single-person operation today (the owner). Escalation contacts:
- **AWS Support:** open a case at https://console.aws.amazon.com/support/ → use the registered email.
- **Anthropic:** support@anthropic.com — has SLA on Sonnet/Haiku availability via Claude API.
- **Paddle:** support@paddle.com — payments + invoicing.
- **Lawyer (data-breach disclosure):** TODO — set up before launch. Most SaaS at this stage uses an outside counsel firm specializing in privacy law (think Cooley, Fenwick, Latham). Quote a 1-day retainer for emergency consultation.

Update this section when adding the second person.

## Detection sources

- **CloudWatch alarms** (Phase 1 + 9a): SNS topic `RivalScan-${stage}-Alerts` → owner email. Most actionable signals come through here:
  - Weekly digest pipeline errors
  - DeepResearch error rate >10% over 15min
  - SES bounce rate >5%
  - API Gateway 5xx, DynamoDB throttling
  - OFAC SDN refresh errors (Phase 9b)
- **AWS Health Dashboard:** account events affecting your services.
- **CloudTrail audit logs** (Phase 9b): for forensic investigation, queryable from `s3://rivalscan-dev-audit-logs/`.
- **Customer reports:** support@rivalscan.com (set up a real inbox; today this routes to the owner).
- **Status page** (Phase 8c, deferred): once shipped, a one-stop public view for users.

## Common scenarios

### 1. AWS account takeover

**Detection:** unfamiliar IAM user creation alarm; CloudTrail shows `ConsoleLogin` from unknown IPs; AWS billing spikes on services you don't use; AWS sends a "suspicious activity" email.

**Response (SEV1):**
1. **Lock the root account.** Console → IAM → root credentials → reset password + rotate root access keys.
2. **Disable suspicious IAM users.** Console → IAM → Users → toggle off all unfamiliar users. Don't delete (preserve evidence).
3. **Rotate ALL secrets.** Follow [SECRET_ROTATION_RUNBOOK.md](SECRET_ROTATION_RUNBOOK.md) emergency procedure for every secret.
4. **Audit CloudTrail** for the past 7 days: `s3://rivalscan-dev-audit-logs/AWSLogs/<account>/CloudTrail/` — grep for unusual region usage, IAM operations, S3 GetObject on customer data.
5. **Open AWS support case** as SEV1. They have a dedicated security incident response team.
6. **Customer comms:** if customer data was accessed (verify via CloudTrail S3 access logs), follow the "Customer data breach" playbook below.
7. **Post-incident:** rotate every credential in the org's password manager, audit all GitHub access tokens, audit lawyer + accountant contacts.

### 2. Anthropic credential leak

**Detection:** Anthropic console shows usage spike from unknown source; cost alarm trips (Phase 1 cost-cap); CloudTrail shows unusual `GetSecretValue` against `rivalscan/api-keys`.

**Response (SEV1):**
1. **Revoke the leaked key.** console.anthropic.com → API Keys → Revoke the affected key. This kills the attacker's access immediately.
2. **Generate a new key + update Secrets Manager** per [SECRET_ROTATION_RUNBOOK.md](SECRET_ROTATION_RUNBOOK.md) emergency procedure. ~5 min outage on research while Lambda caches turn over.
3. **Audit Anthropic usage** for the past 30 days at console.anthropic.com → Settings → Usage. Compare model names + request patterns to your own logs (`ai_call_completed` events in CloudWatch). Anything unaccounted for = attacker traffic.
4. **Pay for the attacker traffic** — Anthropic's terms make you liable for use-until-revoked. The cost-cap kill switch (Phase 1) caps user-attributable spend; if the leak bypassed userId attribution, the org-level cost is yours.
5. **Find the leak source.** Check git history for committed secrets (`git log -S 'sk-ant-'`), screenshots in support tickets, copies in unencrypted backups. Patch the root cause.

### 3. Customer data breach

**Detection:** CloudTrail shows large unauthorized S3 GetObject; DynamoDB Scan from an unfamiliar IP; database export downloaded by an unauthorized user.

**Response (SEV1):**
1. **Cut access immediately.** Stop the bleed: revoke IAM access keys, disable the leaking endpoint, take WAF rule live to block the attacker IPs.
2. **Identify scope.** Which users' data was accessed? CloudTrail bucket has the access logs — query within the last 30 days for unusual `s3:GetObject` against `exports/` or unusual `dynamodb:Scan` operations.
3. **Document everything timestamped.** Your audit trail starts now. Record what you knew, when you knew it, who was notified, what you did. Use a private incident channel (not the company Slack — assume Slack is compromised too).
4. **GDPR Art. 33:** notify the relevant supervisory authority within 72 hours of becoming aware. Template: include what data was breached (categories — emails, billing addresses, etc.), the approximate scope, the consequences, the measures taken.
5. **Notify affected customers.** Plain language. Don't try to spin it. Include: what happened, what data was exposed, what you've done, what they should do (rotate passwords, watch for phishing).
6. **Engage outside counsel** for the disclosure language. Don't ad-lib the legal portion.
7. **Post-incident:** public disclosure timeline, root-cause technical writeup, controls added.

### 4. Sub-processor outage

Anthropic, Paddle, AWS, or SES is down. Most often partial — some regions / endpoints affected.

**Response (SEV2/3):**
1. **Confirm scope.** Check the provider's status page first:
   - Anthropic: https://status.anthropic.com
   - AWS: https://health.aws.amazon.com/health/status
   - Paddle: https://status.paddle.com
   - SES: AWS Health Dashboard for the SES service in our region.
2. **Check our CloudWatch alarms.** If the Phase 1 retry/backoff in `callAnthropic` is absorbing transient blips, no action needed. If alarms are firing repeatedly, our pipeline is genuinely impaired.
3. **Customer comms (if SEV2).** Status-page update (Phase 8c) + email to active users acknowledging the outage. Be specific: "Anthropic's API has been returning 5xx since 14:00 UTC. Our research pipeline is paused until they recover. We'll resume automatically. No data lost." Don't blame them publicly — be factual.
4. **Don't auto-retry indefinitely.** Watch the cost dashboard. If the provider keeps returning 5xx for hours and we keep retrying, we're paying for failed calls. Phase 1's `callAnthropic` retry caps at 2 attempts per call which is fine; runaway loops are unlikely.
5. **Recovery:** once the provider is healthy, the next scheduled cron picks up automatically. No manual replay needed.

### 5. Pipeline runaway (Anthropic cost spike)

A bug or a malicious user triggers an unbounded loop of Sonnet calls.

**Detection:** Phase 1 monthly cost cap kicks in; CloudWatch alarm `RivalScan-${stage}-Alerts` → owner email; Anthropic console shows hour-over-hour spend doubling.

**Response (SEV1/2):**
1. **Cost cap is the brake.** Phase 1's `enforceResearchEligibility` already returns `COST_CAP_EXCEEDED` once `monthToDateCostUsd >= tier.monthlyCostCap`. So the bleeding stops at the per-user cap (Scout $5, Strategist $20, Command $80).
2. **For org-level runaway** (cap doesn't apply because the cost wasn't user-attributable — system tasks don't bump per-user costs): manually disable the offending Lambda. AWS Console → Lambda → function → Configuration → Concurrency → reserve 0.
3. **Identify the runaway.** CloudWatch Logs Insights query: `filter message = "ai_call_completed" | stats sum(costUsd) by opName, userId | sort sum desc`. Top row = where the spend went.
4. **Patch the bug.** Common causes: a recursion in a state machine, a Map state with concurrency too high, a retry loop that doesn't backoff, a malicious user finding a bypass on the eligibility check.
5. **Pay the bill** — costs already incurred can't be clawed back from Anthropic. File an internal P&L line item.
6. **Add monitoring.** Decide whether the cap was set correctly or needs tightening. Add a per-Lambda concurrency cap if relevant.

## Communications templates

### Internal Slack (private incident channel)

```
🚨 SEV{n} {date} {time UTC}: {one-line summary}
Status: investigating | mitigated | resolved
Owner: {person}
Comms: {customers notified? status page updated? regulator notified?}
Last update: {time UTC}
```

### Customer email (template)

```
Subject: {Service Name} — service incident on {date}

We had a service issue affecting {feature} from {start UTC} to {end UTC}.

What happened: {plain-language one paragraph}

What we did: {actions taken, in chronological order}

Impact on your account: {specific to this customer if known, else aggregate}

What's next: {what you're doing to prevent recurrence; timeline for postmortem
publication}

If you have questions, reply to this email — it goes straight to the team.

— {your name}, {Service Name}
```

### Status page snippet (Phase 8c)

```
{Component} {investigating | identified | monitoring | resolved}
{date} {time UTC} — {one-line current state}
Updates every {15 min during SEV1, hourly during SEV2}
```

## Post-incident

After every SEV1 / SEV2:

1. **Blameless postmortem within 7 days.** Use the 5-whys structure. Don't blame humans — blame missing tooling/checks/process.

   Template:
   ```
   ## Incident: {short title}

   ### Summary
   {one paragraph}

   ### Timeline (UTC)
   - 14:00 — {first signal}
   - 14:05 — alarm fired, paged owner
   - 14:08 — owner started investigating
   - 14:30 — root cause identified
   - 14:45 — mitigation deployed
   - 15:00 — confirmed resolved

   ### Root cause
   {what was the actual problem, technically}

   ### Why it happened (5-whys)
   1. Why did X fail? Because Y.
   2. Why did Y happen? Because Z.
   3. ...

   ### What went well
   {alarms fired, runbook was useful, ...}

   ### What went poorly
   {logs were unclear, deploy took too long, ...}

   ### Action items
   - [ ] Add monitoring for {gap}
   - [ ] Tighten {control}
   - [ ] Update runbook for {scenario}
   ```

2. **File** under `incidents/YYYY-MM-DD-{short-title}.md` in the repo. Track action items in your usual issue tracker.

3. **Public disclosure threshold:** mandatory for SEV1 customer-impacting events. Optional but encouraged for SEV2 — builds trust faster than silence. Plain blog post + email is enough at this scale.

## Quarterly review

This runbook gets reviewed alongside the secret rotation cadence. Same calendar event, ~10 min added: read the runbook end-to-end, fact-check contacts, update any procedure that doesn't match current infra. Bump the "last reviewed" footer below.

---

*Last reviewed: 2026-04-30 (initial publication, Phase 9b)*
