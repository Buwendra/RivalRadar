# Vendor Risk Register

> Phase 10a. Annual review tracker for Kironyx's sub-processors. Maps to SOC 2 CC9.2 (vendor and business-partner risk management) and GDPR Art. 28 (processor obligations). Companion to [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md) § Sub-processors and [`/legal/sub-processors`](https://app.kironyx.com/legal/sub-processors) (the public list customers see).

## Cadence

- **Annual review:** every 12 months on a fixed calendar date. Walk each row, refresh the `Last review` column, log findings.
- **Off-cycle review (mandatory):**
  - Vendor publishes a new SOC 2 report → log the date + check for material findings.
  - Vendor announces a security incident affecting Kironyx customers' data.
  - Vendor changes scope (new region, new sub-processors, new data categories).
  - Adding a new sub-processor: must be added to this register AND `/legal/sub-processors` simultaneously, with customer notification.

## Sub-processor inventory

| Vendor | Service | Data shared | Region | Certifications | Last review | Next review | Status |
|---|---|---|---|---|---|---|---|
| **Amazon Web Services** | Hosting (Lambda, DynamoDB, S3, Cognito, SES, Secrets Manager, API Gateway, Step Functions, CloudFront, WAF, CloudTrail) | All workspace data, audit logs, customer email | us-east-1 (N. Virginia) | SOC 2 Type II, ISO 27001, ISO 27017, ISO 27018, PCI DSS Level 1, FedRAMP Moderate | 2026-05-07 | 2027-05-07 | Active |
| **Anthropic** | Claude API (Sonnet 4.5, Haiku 4.5) + web_search tool | Competitor URLs, prompt context (company name, industry, prior research findings), AI response text | US infrastructure | SOC 2 Type II | 2026-05-07 | 2027-05-07 | Active |
| **Paddle** | Payments + merchant of record (subscriptions, tax, billing, invoicing) | Customer email, billing address, payment metadata (cardholder data handled entirely by Paddle — never reaches Kironyx) | UK / EU global | PCI DSS Level 1, SOC 2 Type II | 2026-05-07 | 2027-05-07 | Active |
| **AWS Amplify** | Frontend hosting (Next.js standalone build, CloudFront-backed) | Build artifacts (no runtime customer data) | us-east-1 | (covered by AWS) | 2026-05-07 | 2027-05-07 | Active |
| **Amazon Cognito** | Authentication identities (sign-up, sign-in, password reset, MFA) | Customer email, JWT claims, hashed password | us-east-1 | (covered by AWS) | 2026-05-07 | 2027-05-07 | Active |

## Per-vendor review questions

For each annual review, capture in `VENDOR_RISK_REVIEW_LOG.md` (kept private):

1. **Does the vendor still hold its certifications?** Check the public certifications page or request via AWS Artifact / customer portal.
2. **Is there a current SOC 2 Type II report on file?** AWS / Anthropic / Paddle reports are downloadable to customers; download annually and store in a secure document repository.
3. **Are there any "material findings" or "qualified opinions" in the latest SOC 2 report?** A clean opinion = no action. A qualified opinion or significant control failure = escalate; consider whether to keep using the vendor.
4. **Has the vendor's scope changed?** New regions, new data categories, new sub-processors. Any change requires updating `/legal/sub-processors` and notifying customers.
5. **Have any incidents affected Kironyx during the year?** Cross-reference the vendor's status page history against `INCIDENT_RUNBOOK.md` post-incident logs.
6. **Is the contractual data-processing agreement (DPA) current?** AWS, Anthropic, Paddle each provide a standard DPA on signup. Verify the DPA terms still cover GDPR Art. 28.

## Escalation path

| Situation | Action |
|---|---|
| Vendor announces a breach affecting our data | Immediate `INCIDENT_RUNBOOK.md` § "Sub-processor outage" playbook. Notify customers within 72 hours per GDPR Art. 33. |
| Vendor's SOC 2 report has a material exception | Document the exception in this register. Assess whether the exception affects Kironyx's controls. Consider compensating controls. |
| Vendor terminates a service we depend on | Trigger a roadmap conversation about replacement. AWS / Anthropic / Paddle each have contractual notice periods. |
| Adding a new sub-processor | (a) Add row to this register. (b) Update `/legal/sub-processors`. (c) Email all customers per Privacy Policy commitment of advance notice on sub-processor changes. (d) Update `SECURITY_OVERVIEW.md` and `SECURITY_QUESTIONNAIRE.md`. |

## Critical-services inventory

These are the vendors whose downtime *immediately* breaks Kironyx:

- **AWS** — full service depends on it. Outage = full outage. Mitigation: status page (Phase 8c) auto-broadcasts.
- **Anthropic** — research pipeline depends on it. Outage = research returns 502; existing data still readable. `callAnthropic()` retries on 429/5xx with backoff (Phase 1).
- **Paddle** — payments only. Outage = customers can't subscribe / upgrade; existing subscribers retain access. New-signup flow degrades gracefully.
- **AWS SES** — emails. Outage = weekly digest fails; in-app data still works. Critical alerts via Slack/webhook (Phase 3) provide an alternative path.

## Audit log

| Date | Reviewer | Findings | Actions |
|---|---|---|---|
| _(template)_ | _(name)_ | _(brief)_ | _(brief)_ |

---

Last reviewed: **2026-05-07** by the workspace owner.
Next review due: **2027-05-07**.
