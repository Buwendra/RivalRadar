# RivalScan — Security Overview

> Public-safe one-page summary of RivalScan's security posture. For deep-dive answers, see [SECURITY_QUESTIONNAIRE.md](SECURITY_QUESTIONNAIRE.md) (NDA recommended). For incident response, see [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md).
>
> Last reviewed: **2026-05-07**.

## Architecture summary

- **Single tenant per workspace.** Each workspace's data is logically isolated by tenant key (`USER#<owner-id>`) at the data layer; cross-tenant reads are impossible by construction.
- **Fully serverless on AWS.** Lambda + API Gateway + DynamoDB + S3 + Cognito + SES + Step Functions. No on-premises infrastructure, no co-located hardware, no long-running VMs.
- **Region:** AWS us-east-1 (N. Virginia). Multi-AZ within region. Cross-region failover is a roadmap item.
- **Frontend:** Next.js 14 deployed via AWS Amplify (CloudFront-backed, automatic TLS).
- **Backend:** AWS CDK (TypeScript) → 8 stacks (Database, Storage, Auth, Email, Pipeline, API, Monitoring, StatusPage).

## Data classification

What's stored:

- **Account metadata:** email, name, plan tier, timestamps. Required for service operation.
- **Workspace data:** competitor URLs, AI-generated analysis, weekly briefings, recommendations, change-event records.
- **Audit logs:** actor email + IP + user-agent + action + timestamp. 90-day retention in DynamoDB; 7-year retention in CloudTrail's object-lock S3 bucket.

What's *not* stored:

- **No PHI** (HIPAA out of scope).
- **No payment-card data** (Paddle is the merchant of record; we never see cardholder data).
- **No SSN, biometrics, government IDs, or other sensitive identifiers** beyond account email.
- **No employee records of competitor companies** — the AI input classifier (Phase 1) blocks attempts to research individuals; we monitor companies, not people.

## Encryption

- **In transit:** TLS 1.2+ enforced. API Gateway HTTPS-only. CloudFront enforces TLS 1.2 minimum.
- **At rest:** DynamoDB SSE with AWS-managed KMS. S3 SSE-S3 (audit-logs bucket additionally has object-lock with 7-year retention, governance mode). Cognito user pool encrypted at rest.
- **Secrets:** AWS Secrets Manager with KMS encryption (`rivalscan/api-keys`). 5-minute in-Lambda cache. Quarterly rotation per [SECRET_ROTATION_RUNBOOK.md](SECRET_ROTATION_RUNBOOK.md).
- **Customer passwords:** managed entirely by Cognito. We never see plaintext.
- **API keys:** sha256-hashed at rest; plaintext returned once at creation, never echoed back.

## Access control

- **Customer authentication:** Cognito user pool with email-verification, configurable MFA (SMS/TOTP).
- **Application RBAC:** workspace owner / member roles (Phase 4a/b/c). Owner-only on destructive actions: delete competitor, manage integrations, change billing, rename/delete workspace, transfer ownership, manage API keys.
- **Operator access:** AWS root locked behind hardware MFA. IAM users with console access require MFA. Per-Lambda IAM roles with explicit grants — no wildcard policies.
- **API key access:** scoped per-workspace, owner-only minting. Read-only endpoints under `/v1/*`. Strategist+ plans only.
- **Quarterly access reviews:** documented in [ACCESS_REVIEW_RUNBOOK.md](ACCESS_REVIEW_RUNBOOK.md).

## Audit logging

- **CloudTrail multi-region trail** (Phase 9b) captures all AWS API events with file-validation. Stored in an S3 bucket with object-lock GOVERNANCE mode for 7 years.
- **In-app AuditEvent log** (Phase 4b) records owner-mutating actions: workspace rename/delete/ownership-transfer, member kicks, integration connect/disconnect, competitor delete, billing operations, GDPR export/delete, account suspend/resume, API key create/revoke. Captures actor email + IP + user-agent. 90-day TTL.
- **Per-API-key request logging** (Phase 11): every `/v1/*` call logs to CloudWatch with key id, hits-this-window, and status code.

## Network protection

- **AWS WAF v2** (Phase 9a) with managed rule groups (CommonRuleSet, KnownBadInputs, AmazonIpReputationList) plus a custom rate-based rule (2000 req / 5min per IP).
- **API Gateway stage throttling** (Phase 9a): 100 req/s default, 5 req/s on auth endpoints.
- **Per-API-key throttle** (Phase 11): 60 req/min default per key.
- **AWS Shield Standard** for L3/L4 DDoS absorption (default for all AWS customers).

## Sub-processors

Five sub-processors. Full list with services, regions, and certifications: [`/legal/sub-processors`](https://app.rivalscan.com/legal/sub-processors) (public), [VENDOR_RISK_REGISTER.md](VENDOR_RISK_REGISTER.md) (annual review tracker).

| Vendor | Service | Certifications |
|---|---|---|
| Amazon Web Services | Hosting (Lambda, DynamoDB, S3, Cognito, SES, Secrets Manager) | SOC 2 Type II, ISO 27001/27017/27018 |
| Anthropic | Claude API + web_search tool | SOC 2 Type II |
| Paddle | Payments / merchant of record | PCI DSS Level 1, SOC 2 Type II |
| AWS Amplify | Frontend hosting | (covered by AWS) |
| Amazon Cognito | Authentication identities | (covered by AWS) |

## Incident response

- **Plan:** [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md) — severity definitions (SEV1–SEV4), 5 common-scenario playbooks, communications templates, post-incident review template.
- **Customer notification:** within **72 hours** for confirmed breaches affecting customer data (GDPR Art. 33 SLA).
- **Forensic capability:** CloudTrail with 7-year retention + AuditEvent log with actor IP/UA.
- **Status communication:** [`https://status.rivalscan.com`](https://status.rivalscan.com) auto-updates from CloudWatch alarm transitions (Phase 8c).
- **Vulnerability disclosure:** [`https://app.rivalscan.com/.well-known/security.txt`](https://app.rivalscan.com/.well-known/security.txt) per RFC 9116 → `security@rivalscan.com`.

## Compliance posture

**Shipped:**

- GDPR Art. 15 + 20 (data export), Art. 17 (deletion), Art. 18 (restriction-of-processing self-suspend), Art. 33 (72-hour breach notification SLA).
- CCPA §1798.110 (right to know), §1798.105 (right to delete).
- OFAC SDN denylist with weekly drift-detection cron.
- Sub-processor disclosure list public on the legal pages.

**In progress (engineering):**

- SOC 2 Type 1 readiness — this Audit Readiness Kit ([SECURITY_QUESTIONNAIRE.md](SECURITY_QUESTIONNAIRE.md), [ACCESS_REVIEW_RUNBOOK.md](ACCESS_REVIEW_RUNBOOK.md), [VENDOR_RISK_REGISTER.md](VENDOR_RISK_REGISTER.md), [CHANGE_MANAGEMENT_POLICY.md](CHANGE_MANAGEMENT_POLICY.md), [`Backend/scripts/soc2-evidence-snapshot.sh`](Backend/scripts/soc2-evidence-snapshot.sh)) is the prep base.

**External (deferred until first enterprise pull):**

- SOC 2 Type 1 audit firm engagement (Vanta/Drata/SecureFrame; ~$15-30k tooling + $10-20k audit; 6-12 months).
- Lawyer-finalized DPA (DRAFT version available today at `/legal/dpa`).
- ISO 27001 (only if EU enterprise customers require it).
- External penetration test (often a SOC 2 Type 2 prerequisite).
- Cyber liability insurance.

## Trust resources

- [SECURITY_QUESTIONNAIRE.md](SECURITY_QUESTIONNAIRE.md) — 80-question pre-filled vendor security questionnaire (NDA recommended)
- [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md) — incident response procedures
- [SECRET_ROTATION_RUNBOOK.md](SECRET_ROTATION_RUNBOOK.md) — quarterly secret rotation
- [ACCESS_REVIEW_RUNBOOK.md](ACCESS_REVIEW_RUNBOOK.md) — quarterly access review
- [CHANGE_MANAGEMENT_POLICY.md](CHANGE_MANAGEMENT_POLICY.md) — production deploy + rollback
- [VENDOR_RISK_REGISTER.md](VENDOR_RISK_REGISTER.md) — annual sub-processor review
- [PUBLIC_API.md](PUBLIC_API.md) — read-only API reference
- [`/.well-known/security.txt`](https://app.rivalscan.com/.well-known/security.txt) — vulnerability disclosure
- [`/legal/privacy`](https://app.rivalscan.com/legal/privacy), [`/legal/terms`](https://app.rivalscan.com/legal/terms), [`/legal/dpa`](https://app.rivalscan.com/legal/dpa), [`/legal/sub-processors`](https://app.rivalscan.com/legal/sub-processors) — public policy pages

For questions: **security@rivalscan.com**.
