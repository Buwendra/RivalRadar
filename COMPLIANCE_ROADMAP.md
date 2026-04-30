# Compliance & Safety Roadmap

Phased plan to bring RivalScan to industry-standard compliance posture. Ordered by **legal/operational risk × effort to ship**. Each phase is scoped to be implementable as a single focused session (file paths, deliverables, and acceptance criteria specified) so context isn't lost between handoffs.

> **Disclaimer:** This document is an engineering-led compliance plan, not legal advice. Every "policy" deliverable below requires review by a qualified SaaS attorney before publishing. The technical deliverables can be shipped without a lawyer; the documents (Privacy Policy, ToS, DPA, etc.) cannot.

---

## Status legend

| Symbol | Meaning |
|---|---|
| 🔴 | Required before charging real customers OR exposes material legal risk today |
| 🟡 | Required within 90 days of first paying customer OR before EU/regulated-industry sales |
| 🟢 | Required for enterprise sales OR mature SaaS posture (months out) |
| ⚙️ | Engineering deliverable — buildable in this codebase |
| 📄 | Policy/legal deliverable — requires lawyer review |
| 🏛 | External — third-party audit, insurance, certification |

---

## Phase 1 — Misuse defense + AI safety guardrails 🔴 ⚙️

**Why first:** Directly addresses the concern that motivated this doc. All technical, ~1 day, eliminates the highest immediate operational risks (researching individuals, AI defamation, runaway cost abuse).

**Standards referenced:** Anthropic Acceptable Use Policy; OWASP API Security Top 10 (specifically API4 Resource Consumption, API8 Security Misconfiguration); GDPR Art. 5(1)(b) Purpose Limitation.

### Deliverables

| # | Item | Files | Acceptance |
|---|---|---|---|
| 1.1 | **Pre-research input classifier** — Haiku call (~$0.001/research) before pipeline kicks off; rejects person names, sanctioned entities, non-business targets | New: `Backend/src/shared/services/anthropic.ts` → `classifyResearchTarget()`. Wire into `Backend/src/functions/api/users/onboard.ts` and `Backend/src/functions/api/competitors/create.ts` and `Backend/src/functions/api/competitors/research.ts` | Submitting "John Smith CEO" or "vladimir-putin.ru" returns 400 with user-facing reason; "https://stripe.com" passes |
| 1.2 | **OFAC SDN denylist** — periodic refresh of US Treasury sanctions list, hard reject on URL/domain match | New: `Backend/src/shared/utils/sanctions.ts` with denylist (start with hardcoded ~50 known sanctioned domains; later refresh from OFAC API daily via EventBridge). Called from same handler that runs the classifier | OFAC list domain rejected; standard Fortune 500 domains pass |
| 1.3 | **Per-user research rate limit** — daily counter on User record by tier (Scout=10/day, Strategist=30/day, Command=100/day) | Modify `Backend/src/shared/types/user.ts` to add `researchCountDay`, `researchCountResetAt`. Wire enforcement into `Backend/src/functions/api/competitors/research.ts` (manual trigger) and `Backend/src/functions/api/users/onboard.ts` (initial bulk) | Past tier cap returns 429 with reset time; counter resets at UTC midnight |
| 1.4 | **AI output disclaimers** — every Claude-generated surface tags AI-generated content explicitly | Frontend: `MetricCard` (threat reasoning), `PredictedMovesCard`, `ResearchCard`, `CompetitorTagChips` tooltip → footer line "AI-generated analysis. May contain errors. Internal use only." Backend: weekly digest email template (`Backend/src/functions/scheduled/render-send-email.ts`) gets the same footer | Every AI-output container shows the disclaimer; verified visually in incognito |
| 1.5 | **AI output audit log** — every Claude response stored with timestamp + competitor + user for defamation defense | Add `aiCallId`, `aiModel`, `aiPromptHash`, `aiResponseText` (truncated 4kb) to ResearchFinding + Change + (new) PredictionEvaluation log entries. Optional: separate DynamoDB SK prefix `AILOG#<ts>` for forensic queries | Every Claude call has a retrievable record for 1 year; PII-free (prompt is hashed, not stored verbatim) |

### Out of scope this phase
- Watermarking AI output for tracking re-distribution (stretch)
- Reading-level AI output filter (Claude already filters per Anthropic AUP)

---

## Phase 2 — Legal foundations 🔴 📄+⚙️

**Why second:** Required by every payment processor (Paddle's terms require you to have these), every US state with privacy law (CA, CO, CT, UT, VA), every EU/UK customer (GDPR Art. 13/14 transparency), every B2B sale. Without these, you cannot lawfully accept payments.

**Standards referenced:** GDPR Art. 12-14 (transparency), CCPA §1798.130 (notice at collection), Paddle Merchant Terms §3.3, ePrivacy Directive Art. 5(3) (cookies).

### Deliverables

| # | Item | Files | Acceptance |
|---|---|---|---|
| 2.1 | **Privacy Policy** — covers data collected, processing purposes, lawful basis (GDPR Art. 6), retention, transfers, sub-processors, user rights, contact | New: `Frontend/src/app/(public)/legal/privacy/page.tsx`. Use Termly or iubenda template ($10-30/mo) as starting point — **lawyer review before publishing** | Page accessible at `/legal/privacy`; linked from sign-up flow + footer |
| 2.2 | **Terms of Service** — service description, AUP, AI-output disclaimer, IP ownership, liability cap, governing law, arbitration, cancellation | New: `Frontend/src/app/(public)/legal/terms/page.tsx`. Termly template + lawyer review. Must explicitly forbid: researching individuals, sanctioned entities, automated trading decisions, redistribution of AI outputs | Page at `/legal/terms`; mandatory checkbox at sign-up; refusal blocks sign-up |
| 2.3 | **Acceptable Use Policy (AUP)** — granular rules referenced by ToS | New: `Frontend/src/app/(public)/legal/aup/page.tsx`. Mirrors Anthropic's AUP structure. See Appendix A below for draft language | Linked from ToS, accessible standalone |
| 2.4 | **Sub-processor disclosure** — list all third parties processing user data | New: `Frontend/src/app/(public)/legal/sub-processors/page.tsx`. See Appendix B below for accurate current list. Add an email subscription endpoint so customers get notified of sub-processor changes (GDPR Art. 28(2) requirement) | Page lists AWS, Anthropic, Paddle, GitHub, SES with regions + purpose; subscription endpoint works |
| 2.5 | **Cookie / storage notice** — explicit notice for localStorage usage (auth tokens) | Frontend: small first-load banner on public + dashboard surfaces. Functional storage (auth) is exempt from consent under ePrivacy Recital 25, but disclosure is still required | Banner appears once per device; dismissible; cookie-policy link works |
| 2.6 | **Consent tracking** — store ToS/Privacy version + accepted-at timestamp on User record at signup | Modify `Backend/src/functions/api/auth/signup.ts` to require `tosVersion` + `privacyVersion` in body; store on User. Update sign-up form | New users have non-null consent fields; existing users will need a one-time re-consent banner at next login |
| 2.7 | **Marketing opt-in vs transactional emails** | Confirm SES uses different `From:` addresses for transactional (alerts/digest) vs marketing (none today, but plan for it) | All current emails categorized; CAN-SPAM Act compliance (US): unsubscribe link in any future marketing email |

### Owner split
- **Engineering** ships the pages + consent flow (~1 day)
- **You/lawyer** writes the actual policy text (~1-3 days lawyer time)

---

## Phase 3 — Data subject rights 🔴 ⚙️

**Why third:** GDPR Art. 15-22 + CCPA §1798.100-130 require you to honor user data requests within 30 (CCPA) or 30-90 (GDPR) days. Without API support, every request becomes a manual ticket — feasible at low scale but blocking for any EU/CA customer.

**Standards referenced:** GDPR Articles 15 (Access), 16 (Rectification), 17 (Erasure), 18 (Restriction), 20 (Portability); CCPA §1798.100 (Right to Know), §1798.105 (Right to Delete), §1798.110 (Right to Access), §1798.120 (Opt-Out of Sale).

### Deliverables

| # | Item | Files | Acceptance |
|---|---|---|---|
| 3.1 | **Right to Access — export endpoint** | New: `Backend/src/functions/api/users/export.ts` → `GET /users/me/export`. Streams JSON of: User record, Subscription, all Competitors, all Changes, all ResearchFindings, all login timestamps. Returns 202 + email link if total > 1MB (avoids API Gateway 30s timeout) | Logged-in user gets their data in machine-readable JSON within 30 days (via email if async) |
| 3.2 | **Right to Erasure — delete endpoint** | New: `Backend/src/functions/api/users/delete.ts` → `DELETE /users/me`. Hard-deletes User + Subscription + Competitor records + Change records + ResearchFinding records. Cancels Cognito user. Cancels Paddle subscription. Sends confirmation email with deletion certificate | After call, all the user's data is purged within 30 days; subsequent login fails |
| 3.3 | **Right to Rectification — profile edit** | Already partly exists in `Backend/src/functions/api/users/profile.ts` (PUT). Extend to allow editing companyName, industry. Frontend: settings page form | Settings page lets user update their profile fields |
| 3.4 | **Right to Restriction — account suspension** | Add `status: 'active' \| 'restricted'` to User type. When restricted, all API routes return 451 Unavailable For Legal Reasons. New endpoint `POST /users/me/restrict` so user can self-suspend pending an inquiry | Restricted user sees a "Your account is restricted" banner; data preserved but research disabled |
| 3.5 | **DPA (Data Processing Agreement) template** 📄 | Use Anthropic's DPA template + customize. Stored at `/legal/dpa` for download; offered at signup for B2B users; counter-signed for enterprise customers | DPA accessible to logged-in users; legal contact email works |
| 3.6 | **Data retention policy** | Document published at `/legal/retention`. Default: research data retained 1 year, account data retained 5 years post-cancellation for tax/dispute purposes (US: IRS retention 7y for tax; EU: GDPR usually 6y for contracts) | Policy is published and the deletion/expiry logic in code matches it |

---

## Phase 4 — Web app security hardening 🟡 ⚙️

**Why fourth:** OWASP Top 10 hardening reduces breach probability. Not strictly legally required for SaaS at low scale, but if a breach happens you need to demonstrate "reasonable security measures" (CCPA §1798.150) for the safe-harbor defense.

**Standards referenced:** OWASP Top 10 (2021); NIST SP 800-53 (selected controls); AWS Well-Architected Security Pillar.

### Deliverables

| # | Item | Files | Acceptance |
|---|---|---|---|
| 4.1 | **Security headers** (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | Frontend: `Frontend/next.config.mjs` → headers config. CSP starts in report-only mode; tighten over 2-4 weeks | `securityheaders.com` scans the site at A grade |
| 4.2 | **Rate limiting on all auth endpoints** | API Gateway throttling on `/auth/signup`, `/auth/signin`, `/users/me`. Cognito has built-in lockout but supplement with API-Gateway-level | Brute force from a single IP locked out after 10 failed attempts in 5 min |
| 4.3 | **Dependency vulnerability scanning** | Add `npm audit` to Amplify build (fail on high+); add `npm audit fix` weekly via GitHub action; Dependabot alerts on the repo | New high-severity CVE blocks the build until patched |
| 4.4 | **Secret rotation** | Document the rotation process for `rivalscan/api-keys` Secrets Manager entry. Rotate Anthropic + Paddle keys quarterly | Runbook documented; rotation log entry on first execution |
| 4.5 | **Input validation everywhere** | Already use Zod on most handlers; audit each `apiHandler` to confirm. Add for missing routes | All POST/PUT bodies validated; reject with 400 + field-level error |
| 4.6 | **AWS WAF on API Gateway** | Add WAFv2 rule set: AWS Managed Rules (Common Rule Set + Known Bad Inputs); rate-based rule (5000 req/5min/IP) | WAF blocks SQL injection / XSS attempts; CloudWatch shows metrics |
| 4.7 | **CloudFront / Amplify CDN with DDoS protection** | Already using Amplify which includes CloudFront. Verify AWS Shield Standard is on (free, default) | AWS Shield enabled; baseline DDoS protection in place |
| 4.8 | **Logging hygiene** — no secrets, tokens, PII in CloudWatch logs | Audit `logger.ts` calls; never log Authorization headers, Anthropic responses verbatim, or User passwords/email content. Add a `redactSecret()` helper | Random log inspection finds zero credentials |

---

## Phase 5 — Audit infrastructure & incident response 🟡 ⚙️+📄

**Why fifth:** SOC 2 prep work; required by enterprise procurement teams. Without audit trails, breach forensics are impossible.

**Standards referenced:** SOC 2 Trust Services Criteria — Common Criteria (CC) Series, especially CC7 (System Operations); GDPR Art. 33 (breach notification within 72h); NIST SP 800-61 (incident handling).

### Deliverables

| # | Item | Files | Acceptance |
|---|---|---|---|
| 5.1 | **CloudTrail enabled** for control-plane events (IAM, S3, DynamoDB) | CDK: `Backend/lib/stacks/monitoring.stack.ts` adds CloudTrail trail with S3 destination, log validation enabled, encrypted | Every IAM/admin action audited |
| 5.2 | **Application audit log** — `actor` field on every DynamoDB write | Modify `putItem` / `updateItem` callers to tag with `actor: 'user:<id>' \| 'system' \| 'cron'`. Optional: separate AILOG SK prefix for AI-generated writes | Trace any record back to the actor |
| 5.3 | **Incident response runbook** 📄 | New: `INCIDENT_RESPONSE.md` at project root. Covers: detection (CloudWatch alarms), triage, containment, eradication, recovery, post-mortem template, GDPR Art. 33 72-hour breach notification process | Runbook reviewed quarterly; contact tree current |
| 5.4 | **Status page** | Use Statuspage.io (free tier) or build a `/status` page on the public site that pings the API. Required for enterprise customers in their TPRM (third-party risk management) reviews | Status page accessible; 99.9% SLA documented |
| 5.5 | **Backup + recovery testing** | DynamoDB has point-in-time recovery (already enabled). Document recovery runbook; quarterly test restore | Restore drill completed; RTO/RPO documented |
| 5.6 | **Incident notification email channel** | Verified SES sender for `security@yourdomain.com` (and a corresponding `dpo@` for GDPR data protection officer queries) | Email aliases set up; auto-reply with case number works |

---

## Phase 6 — Operational programs 🟢 📄+⚙️

**Why sixth:** Ongoing programs, not one-shot fixes. Becomes valuable when customer base grows or enterprise sales begin.

**Standards referenced:** SOC 2 CC1 (Control Environment); NIST CSF (Identify, Protect, Detect functions).

### Deliverables

| # | Item | Notes |
|---|---|---|
| 6.1 | **Vulnerability disclosure policy + security.txt** | Static `/.well-known/security.txt` on the frontend; policy at `/legal/security`. Inbound `security@` mailbox monitored |
| 6.2 | **Bug bounty (optional, low cost)** | HackerOne / Bugcrowd entry-level programs ~$500/year; only if you have meaningful customer data |
| 6.3 | **Vendor risk management** | Annual review of Anthropic, AWS, Paddle, Amplify SOC 2 reports; document review in a tracker |
| 6.4 | **Annual security awareness training** | Required by SOC 2; even for solo founders, complete a free course (e.g., AWS Security Fundamentals) annually with proof |
| 6.5 | **Access review** | Quarterly review of who has IAM credentials, Paddle dashboard access, GitHub admin. Document owners + dates |
| 6.6 | **Change management policy** | Required by SOC 2 CC8.1. Document: every prod deploy goes through PR review, CI checks must pass, on-call notified for high-risk changes |
| 6.7 | **Privacy Impact Assessment (DPIA)** for the AI research feature 📄 | GDPR Art. 35 — required for high-risk processing. AI-driven analysis of identifiable third parties (competitor employees mentioned in research) likely qualifies. Template at ICO.org.uk |

---

## Phase 7 — Formal certifications 🟢 🏛

**Why last:** Months of effort, $15-50k+ each, but unlock enterprise contracts. Wait until you have ~$500k ARR or a specific deal pulling.

| # | Item | When | Cost |
|---|---|---|---|
| 7.1 | **SOC 2 Type II audit** | First enterprise lead asks for a SOC report. Use Vanta/Drata/SecureFrame ($15-30k for tooling + $10-20k for audit; takes 6-12 months) | $25-50k year 1, $15-30k/year ongoing |
| 7.2 | **Cyber liability insurance** | Before first paying customer (D&O typically bundled) | $1-3k/year (Vouch / Embroker / Coalition) |
| 7.3 | **ISO 27001** | EU enterprise customers prefer this over SOC 2. Skip unless explicit demand | ~$30-60k first cert, $10-20k/year |
| 7.4 | **HIPAA BAA** | Only if you sell into healthcare. AWS BAA available; need a HIPAA-aware lawyer | Variable |
| 7.5 | **PCI DSS** | NOT required since Paddle is merchant of record. Stays out of scope unless you ever take cards directly | N/A |
| 7.6 | **Penetration test (annual)** | Often a SOC 2 prerequisite; also asked by enterprise procurement | $5-15k/year |

---

## Phase ordering rationale

```
Phase 1 (misuse defense)     Phase 2 (legal docs)
       │                            │
       ├────────►   Phase 3 (data subject rights)
       │                            │
       └────────►   Phase 4 (security hardening)
                                    │
                           Phase 5 (audit + IR)
                                    │
                           Phase 6 (operational programs)
                                    │
                           Phase 7 (certifications)
```

Phases 1 and 2 are independent and can run in parallel (1 is engineering, 2 is policy). Both are required before charging real customers.

Phases 3 and 4 can run in parallel after Phase 2.

Phases 5-7 build on the previous foundation and become relevant as customer count grows.

---

## Available context budget per phase

Each phase below is sized to fit one focused implementation session (the kind we've been doing). File paths are listed so the next session doesn't re-discover them.

| Phase | Scope | Token-budget feel |
|---|---|---|
| 1 | 5 items, 1 new shared service + ~6 file edits | ~1 medium session |
| 2 | 6 frontend pages + 1 backend signup change | ~1 medium session (excluding lawyer-written content) |
| 3 | 4 new endpoints + 2 schema additions | ~1 medium session |
| 4 | 8 hardening items, mostly config | ~1 medium session |
| 5 | 6 items, mix of CDK + docs | ~1 medium session |
| 6 | Mostly documentation + ops | Spread across multiple short sessions |
| 7 | External — not implementable here | N/A |

If a phase grows beyond a session, split by the # markers in each table — every numbered item is independently shippable.

---

## Appendix A — Acceptable Use Policy (draft)

The following uses of RivalScan are **prohibited**. Violation results in account termination and may be reported to law enforcement. This list is non-exhaustive.

1. **Personal individual research.** Researching natural persons (employees, executives, public figures) outside of their professional capacity at a clearly-identified business entity. Targets must be incorporated companies.
2. **Sanctioned entities.** Researching individuals or entities on the U.S. OFAC SDN list, EU Consolidated Sanctions list, UK HMT sanctions list, or comparable national sanctions registries.
3. **Stalking, harassment, or doxxing.** Using research output to harm, embarrass, or threaten any person.
4. **Trading decisions.** Using research output as the basis for securities trading. RivalScan is not a registered investment advisor and outputs may be inaccurate.
5. **Redistribution of AI output.** Republishing, broadcasting, or commercializing RivalScan-generated text without explicit written permission. Internal-team use is permitted.
6. **Competitive intelligence on protected categories.** Targeted research designed to identify employees by race, gender, religion, disability, age, sexual orientation, or other protected status.
7. **Trade secret misappropriation.** Attempting to extract or summarize confidentially-held information of another party (leaked documents, breached materials, unpublished filings).
8. **Defamation.** Using RivalScan output as the basis for false, damaging public statements about any person or entity.
9. **Automated mass research.** Scripting or automating the research API beyond what individual interactive use requires (programmatic access requires written permission).
10. **Resale of access.** Sharing accounts, reselling credentials, or providing the service to third parties under your own account.

---

## Appendix B — Current sub-processor list

| Sub-processor | Purpose | Region(s) | Compliance |
|---|---|---|---|
| Amazon Web Services (AWS) | Application hosting (Lambda, DynamoDB, S3, Cognito, API Gateway, Step Functions, SES, Secrets Manager, CloudWatch) | us-east-1 (N. Virginia) | SOC 2 Type II, ISO 27001, ISO 27018, ISO 27017 |
| AWS Amplify | Frontend hosting + CI/CD | us-east-1 | (inherits AWS compliance) |
| Anthropic | AI model API (Claude Sonnet 4.5, Haiku 4.5, web_search tool) | US infrastructure | SOC 2 Type II |
| Paddle | Payment processing + merchant of record (subscriptions, tax, billing) | UK / EU global | PCI DSS Level 1, SOC 2 Type II |
| GitHub | Source code hosting + CI integration with Amplify | US | SOC 1/2/3 Type II, ISO 27001 |

This list must be updated within 14 days of any change. Customers should be notified by email of new sub-processors with a 30-day objection window (GDPR Art. 28(2)).

---

## Appendix C — Industry standards referenced (accurate citations)

| Standard | Authority | Scope | Where it applies in this roadmap |
|---|---|---|---|
| **GDPR** (Regulation (EU) 2016/679) | EU Parliament + Council | Personal data of EU/EEA residents | Phases 2, 3, 6 |
| **CCPA / CPRA** (Cal. Civ. Code §1798.100 et seq.) | California Attorney General | Personal information of CA residents | Phases 2, 3 |
| **Anthropic AUP** | Anthropic PBC | Use of Claude API | Phase 1, Appendix A |
| **OWASP API Security Top 10** (2023) | Open Worldwide Application Security Project | Web/API security baseline | Phase 4 |
| **OWASP Web Top 10** (2021) | OWASP | Web application vulnerabilities | Phase 4 |
| **NIST SP 800-53** | National Institute of Standards and Technology | Security & privacy controls | Phase 4, 5 |
| **NIST SP 800-61** | NIST | Computer security incident handling | Phase 5 |
| **NIST CSF 2.0** | NIST | Cybersecurity framework (Identify, Protect, Detect, Respond, Recover) | Phase 6 |
| **SOC 2 (TSC 2017 with 2022 revisions)** | AICPA | Trust Services Criteria — Security, Availability, Processing Integrity, Confidentiality, Privacy | Phases 5, 6, 7 |
| **ISO/IEC 27001:2022** | ISO/IEC | Info security management systems | Phase 7 |
| **PCI DSS v4.0** | PCI Security Standards Council | Cardholder data environments | NOT in scope (Paddle handles) |
| **HIPAA** (45 CFR Parts 160, 162, 164) | US HHS | Protected health information | Only if healthcare customers |
| **CAN-SPAM Act** (15 U.S.C. §7701) | US FTC | Commercial email | Phase 2 (transactional vs marketing) |
| **ePrivacy Directive** (2002/58/EC) | EU | Cookies & electronic comms | Phase 2 (cookie/storage notice) |
| **AWS Shared Responsibility Model** | Amazon | Customer vs AWS security responsibilities | Phases 4, 5 (clarifies what we do vs AWS does) |
| **OFAC SDN List** | US Treasury | Sanctioned individuals & entities | Phase 1 (denylist) |

---

## What I, as engineer, can and cannot do

| Can do (in this codebase) | Cannot do (need lawyer/auditor/insurer) |
|---|---|
| All ⚙️ items: classifier, rate limit, disclaimers, audit logs, security headers, WAF, endpoints for export/delete, CloudTrail, etc. | Draft binding Privacy Policy / ToS / DPA / AUP text |
| Wire content into pages once you have policy text | SOC 2 audit, ISO 27001 cert |
| Write internal runbooks (incident response, recovery, change mgmt) | Cyber liability insurance underwriting |
| Implement OFAC list scraping + denylist | Trademark search, entity formation, sales tax registration |
| Build data export / delete flows | Sign DPAs as a data controller / processor |
| | Final legal review of all 📄 documents |

---

## Recommended starting point

**Today:** Phase 1 in full (~1 day of engineering). It's all ⚙️ work I can do this session, eliminates the misuse vector that prompted this doc, and adds the audit trail that backs Phases 5-7.

**Within 2 weeks of any paying customer:** Phase 2 (engineering ~1 day; lawyer ~3 days separately).

**Within 30 days of first EU/CA customer:** Phase 3 (~1 day engineering).

**Before serious enterprise outreach (>$500k ARR):** Phases 4-7 in order.

The technical work in Phases 1-5 is roughly **5 focused engineering sessions** end-to-end. The policy + legal work runs in parallel and is gated on lawyer availability, not engineering capacity.
