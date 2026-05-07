# RivalScan — Security Questionnaire (Pre-filled)

> Pre-filled answers to standard B2B procurement security questions. Format mirrors **SIG Lite** (Standardized Information Gathering, lightweight). Easy to convert to Vanta / SecureFrame / SecurityPal / customer-bespoke questionnaires.
>
> **Every "Yes" maps to a real shipped control with an evidence pointer.** Aspirational answers ("Roadmap" / "Partial" / "No") are honest about what's deferred. Last reviewed: 2026-05-07.

## Vendor profile

| Field | Value |
|---|---|
| Vendor name | RivalScan |
| Service description | AI-powered competitive-intelligence monitoring for SMBs |
| Hosting region | AWS us-east-1 (N. Virginia) |
| Architecture | Single-tenant (per-workspace) on shared serverless infrastructure |
| Sub-processors | AWS, Anthropic, Paddle (payments), Amplify (frontend hosting), Cognito (auth) |
| SOC 2 Type 1 status | In progress (Phase 10 prep complete; audit firm engagement deferred until first enterprise contract pulls) |
| ISO 27001 status | Not pursued; AWS underlying infra is ISO 27001 / 27017 / 27018 certified |
| Penetration test | Internal review; external pen test deferred until first enterprise contract |
| Cyber liability insurance | Deferred until first paying customer threshold |

---

## A. Risk Assessment & Governance

| # | Question | Answer | Evidence |
|---|---|---|---|
| A.1 | Is there a documented information-security policy? | **Yes** | `SECURITY_OVERVIEW.md`; `CHANGE_MANAGEMENT_POLICY.md`; `INCIDENT_RUNBOOK.md` at repo root. |
| A.2 | Is the policy reviewed at least annually? | **Yes — quarterly** | Calendar reminder paired with secret-rotation cadence; see `SECRET_ROTATION_RUNBOOK.md` § Audit log. |
| A.3 | Is there a designated security officer? | **Yes** | Solo-founder operation today; the owner is the security officer. Documented in `INCIDENT_RUNBOOK.md` § On-call. |
| A.4 | Is there a written risk-assessment methodology? | **Partial** | Risks tracked per-phase in `PRODUCT_GAPS_ROADMAP.md` and `COMPLIANCE_ROADMAP.md` "Risks" sections. Formal annual risk register: roadmap. |
| A.5 | Are third-party risks (sub-processor risks) assessed annually? | **Yes** | `VENDOR_RISK_REGISTER.md` at repo root. Annual review against each sub-processor's published SOC 2 report. |

## B. Security Policy & Compliance

| # | Question | Answer | Evidence |
|---|---|---|---|
| B.1 | Are GDPR, CCPA obligations met? | **Yes** | GDPR Art. 15+20 self-export and Art. 17 self-deletion shipped (Phase 1 of `COMPLIANCE_ROADMAP.md`). Privacy Policy at `/legal/privacy`. CCPA notice-at-collection on the Privacy page. |
| B.2 | Is a Data Processing Addendum (DPA) available? | **Partial** | DRAFT DPA at `/legal/dpa`. Lawyer-finalized version is a Phase 10 external deliverable. |
| B.3 | Are sub-processors disclosed to customers? | **Yes** | Public sub-processor list at `/legal/sub-processors`; identical list maintained in `COMPLIANCE_ROADMAP.md` and `VENDOR_RISK_REGISTER.md`. |
| B.4 | Has a Data Protection Impact Assessment (DPIA) been performed? | **Roadmap** | DPIA for the AI competitor-research feature is tracked in `COMPLIANCE_ROADMAP.md` Phase 6.7. Standard ICO template. Pending. |
| B.5 | Is processing limited to a documented purpose? | **Yes** | Pre-research input classifier (Phase 1 of `COMPLIANCE_ROADMAP.md`) blocks attempts to research individuals or sanctioned entities. OFAC SDN denylist enforced. |
| B.6 | Is OFAC / sanctions screening in place? | **Yes** | OFAC SDN denylist with weekly drift-detection cron (Phase 9b — `Backend/src/functions/scheduled/refresh-ofac-sdn.ts`). |

## C. Personnel Security

| # | Question | Answer | Evidence |
|---|---|---|---|
| C.1 | Are background checks performed on staff with access to customer data? | **N/A** | Solo-founder operation today. When team grows: standard pre-employment screening per local employment law. |
| C.2 | Is annual security-awareness training completed? | **Roadmap** | Tracked in `COMPLIANCE_ROADMAP.md` Phase 6.4. Free AWS Security Fundamentals course planned. |
| C.3 | Are NDAs in place with all staff and contractors? | **Yes (when applicable)** | Solo-founder today. Future contractors: standard NDA template before access. |
| C.4 | Is there a documented offboarding procedure? | **Yes** | Triggers a full off-cycle access review per `ACCESS_REVIEW_RUNBOOK.md` — credentials rotated, IAM users disabled, GitHub access revoked. |

## D. Physical & Environmental Security

| # | Question | Answer | Evidence |
|---|---|---|---|
| D.1 | Where is customer data physically stored? | **AWS us-east-1 data centers (Northern Virginia)** | AWS data centers maintain SOC 2 Type II, ISO 27001, ISO 27017, ISO 27018, PCI DSS Level 1. AWS published controls documentation: `https://aws.amazon.com/compliance/` |
| D.2 | Are data center physical-access controls audited? | **Yes (inherited from AWS)** | AWS SOC 2 Type II reports cover physical access controls (CC6.4). Customer can request AWS Artifact reports. |
| D.3 | Does the vendor operate any on-premises infrastructure? | **No** | Fully serverless on AWS. No on-prem servers, no co-located hardware. |

## E. Operations Security

| # | Question | Answer | Evidence |
|---|---|---|---|
| E.1 | Is there a change-management process for production deploys? | **Yes** | `CHANGE_MANAGEMENT_POLICY.md` at repo root. PR review + CI gates (tsc + lint + cdk synth + Dependabot/npm-audit) before merge. |
| E.2 | Are CI/CD pipelines secured? | **Yes** | GitHub Actions with secrets scoped to repo. No long-lived deploy keys; deployments use the owner's local AWS credentials with MFA. Phase 9b shipped Dependabot weekly + npm-audit weekly + on every PR. |
| E.3 | Are systems and applications patched regularly? | **Yes** | Dependabot weekly grouped PRs for npm + GitHub Actions ecosystems (Phase 9b config in `.github/dependabot.yml`). Lambda runtime auto-patches via AWS managed runtime. |
| E.4 | Is malware protection in place on staff endpoints? | **Yes** | Owner workstation runs OS-vendor endpoint protection (macOS Gatekeeper / Windows Defender). |
| E.5 | Are backups performed? | **Yes** | DynamoDB Point-in-Time Recovery (PITR) enabled; covers any 1-second window in the prior 35 days. S3 versioning enabled on the audit-logs bucket with 7-year object-lock retention. |
| E.6 | Are backups tested for restore? | **Roadmap** | Quarterly backup-restore drill is on the roadmap; evidence-snapshot script captures PITR config to verify it stays enabled. |

## F. Access Control

| # | Question | Answer | Evidence |
|---|---|---|---|
| F.1 | Is multi-factor authentication enforced on admin accounts? | **Yes** | AWS root account uses hardware MFA. IAM users with console access require MFA. **Evidence:** `aws iam get-account-summary` from `Backend/scripts/soc2-evidence-snapshot.sh`. |
| F.2 | Is least-privilege enforced for IAM? | **Yes** | Per-Lambda IAM roles via CDK with explicit grants (`table.grantReadWriteData(fn)` etc.). No wildcard `*:*` policies. |
| F.3 | Are customer-facing accounts protected with MFA? | **Optional** | Cognito user pool supports SMS / TOTP MFA. Customers self-enroll via account settings. Enforcement is roadmap. |
| F.4 | Is there role-based access control (RBAC) within the application? | **Yes** | Workspace-level owner / member roles (Phase 4a/b/c). Owner-only gates on destructive actions: delete competitor, manage integrations, change billing, rename/delete workspace, transfer ownership. |
| F.5 | Are access reviews performed? | **Yes — quarterly** | `ACCESS_REVIEW_RUNBOOK.md` at repo root. Per-system table; same cadence as secret rotation. |
| F.6 | Are access keys rotated? | **Yes** | `SECRET_ROTATION_RUNBOOK.md` mandates quarterly rotation for application secrets (Anthropic, Paddle). AWS access keys rotated quarterly per same runbook. |
| F.7 | Are sessions terminated on inactivity? | **Yes** | Cognito ID tokens expire after 1 hour; refresh tokens expire after 30 days. Frontend re-prompts sign-in on 401. |
| F.8 | Is SAML / SSO supported? | **Roadmap** | Supported by Cognito infrastructure. Surface deferred until first enterprise-tier customer requires it. |

## G. Application Security

| # | Question | Answer | Evidence |
|---|---|---|---|
| G.1 | Is the application developed following secure-coding practices? | **Yes** | TypeScript strict mode; zod validation at every API boundary; OWASP Top 10 reviewed in code review. Phase 1 misuse-defense classifier blocks abusive inputs. |
| G.2 | Is input validated at the API boundary? | **Yes** | Every API handler uses `validate(schema, parseBody(event))` from `Backend/src/shared/middleware/validation.ts`. Zod schemas centralize validation rules. |
| G.3 | Is output sanitized to prevent XSS? | **Yes** | React's default HTML escaping prevents stored XSS. Email templates render through SES with auto-sanitization. AI-generated text rendered as plain text — no `dangerouslySetInnerHTML`. |
| G.4 | Is SQL injection prevented? | **N/A** | No SQL surface. DynamoDB (NoSQL) accessed through parameterized AWS SDK calls in `Backend/src/shared/db/queries.ts`. |
| G.5 | Is CSRF protection in place? | **Yes** | API uses Bearer tokens (Cognito JWT) — no cookie-based session, so CSRF tokens unnecessary. CORS allowlist scoped to the production frontend origin. |
| G.6 | Are API endpoints rate-limited? | **Yes** | API Gateway stage throttling (Phase 9a): 100 req/s default, 5 req/s on auth endpoints. AWS WAF managed rules + custom rate-based rules (2000 req / 5min per IP). Per-API-key throttle 60 req/min (Phase 11). |
| G.7 | Is dependency vulnerability scanning in place? | **Yes** | Phase 9b: `npm audit --audit-level=high` runs on every PR + weekly; Dependabot weekly grouped PRs; CI fails on high/critical vulns. |
| G.8 | Are static-analysis / linting checks enforced? | **Yes** | Backend: TypeScript strict + tsc --noEmit on every PR. Frontend: TypeScript strict + ESLint on every PR. CDK synth on every PR catches IaC drift. |

## H. Cryptography

| # | Question | Answer | Evidence |
|---|---|---|---|
| H.1 | Is data encrypted at rest? | **Yes** | DynamoDB table SSE with AWS-managed KMS. S3 buckets SSE-S3 encryption (audit-logs bucket additionally has object-lock). Cognito user pool encrypted at rest. |
| H.2 | Is data encrypted in transit? | **Yes (TLS 1.2+)** | API Gateway HTTPS-only (HTTP listener absent). CloudFront in front of frontend serves TLS 1.2 minimum. SES outbound mail uses TLS opportunistically. |
| H.3 | Are encryption keys managed in a HSM? | **Partial** | AWS-managed KMS uses FIPS 140-2 Level 2 validated HSMs for the underlying keys. Customer-managed keys (CMKs) not used today; future SOC 2 Type 2 milestone. |
| H.4 | Are passwords hashed? | **Yes** | Cognito-managed password storage uses SRP + bcrypt-equivalent hashing. We never see plaintext passwords. API keys hashed via sha256 (Phase 11) before storage; plaintext returned exactly once at creation. |
| H.5 | Is key rotation performed? | **Yes** | AWS-managed KMS keys auto-rotate annually. Application secrets (Anthropic, Paddle) rotated quarterly per `SECRET_ROTATION_RUNBOOK.md`. |

## I. Network Security

| # | Question | Answer | Evidence |
|---|---|---|---|
| I.1 | Is a Web Application Firewall (WAF) deployed? | **Yes** | AWS WAF v2 with managed rule groups (AWSManagedRulesCommonRuleSet, AWSManagedRulesKnownBadInputsRuleSet, AWSManagedRulesAmazonIpReputationList) plus a rate-based rule capping 2000 req / 5min per IP. Phase 9a. |
| I.2 | Are network segmentation controls in place? | **N/A** | Fully serverless — no VPCs, subnets, or security groups to segment. Lambda execution roles enforce per-function least-privilege at the IAM layer. |
| I.3 | Is DDoS protection in place? | **Yes** | AWS Shield Standard (automatic for all AWS customers). API Gateway + CloudFront absorb basic L3/L4 attacks; WAF rate rules cap L7 abuse. |
| I.4 | Is DNS configured securely? | **Partial** | DNSSEC supported by Route 53 (not yet enabled — roadmap). DMARC / SPF / DKIM configured for SES sending domain. |
| I.5 | Are TLS configurations regularly tested? | **Roadmap** | Plan: monthly check via Mozilla Observatory or `testssl.sh`. AWS-managed certificates via ACM auto-renew. |

## J. Compliance

| # | Question | Answer | Evidence |
|---|---|---|---|
| J.1 | Is the service GDPR-compliant? | **Yes** | Art. 15+20 (export) and Art. 17 (deletion) shipped. Art. 18 (restriction-of-processing self-suspend) shipped Phase 9a. Sub-processor disclosure at `/legal/sub-processors`. |
| J.2 | Is the service CCPA-compliant? | **Yes** | §1798.110 right-to-know via `/users/me/export`. §1798.105 right-to-delete via `/users/me`. Privacy Policy includes notice at collection. |
| J.3 | Is HIPAA covered? | **No (out of scope)** | RivalScan does not process protected health information (PHI). HIPAA BAA not offered. |
| J.4 | Is PCI DSS applicable? | **No** | Paddle is the merchant of record; we never see cardholder data. Our scope is limited to receiving billing event webhooks. |
| J.5 | Is SOC 2 attested? | **In progress** | Phase 10a (this kit) prepares the evidence base. Type 1 audit firm engagement deferred until first enterprise pull. |

## K. Privacy

| # | Question | Answer | Evidence |
|---|---|---|---|
| K.1 | What categories of personal data are processed? | **Account-level only** | Account email + name (registration); audit-log actor email + IP; billing email (handled by Paddle). NOT collected: SSN, PHI, biometrics, financial account numbers. |
| K.2 | Are individuals notified at collection? | **Yes** | Privacy Policy at `/legal/privacy` includes notice at collection. Sign-up flow links the policy. |
| K.3 | Are individual rights (access, deletion, portability) supported? | **Yes** | Self-service via `/users/me/export` (data portability, GDPR Art. 20) and `DELETE /users/me` (erasure, Art. 17). |
| K.4 | Is a data retention schedule documented? | **Yes** | Audit events: 90-day TTL (Phase 4b). CloudTrail evidence: 7-year object-lock (Phase 9b). Cost-day rollups: 90-day TTL (Phase 1). User data: indefinite until self-deletion. |
| K.5 | Is data shared with third parties? | **Limited to sub-processors** | Sub-processors enumerated at `/legal/sub-processors`. No data sales. No advertising trackers. |

## L. Incident Response

| # | Question | Answer | Evidence |
|---|---|---|---|
| L.1 | Is there an incident-response plan? | **Yes** | `INCIDENT_RUNBOOK.md` at repo root. SEV1–SEV4 definitions, 5 common-scenario playbooks, communications templates, post-incident review template. |
| L.2 | Is incident-response training conducted? | **Roadmap** | Solo-founder operation today; tabletop exercise on the roadmap pre-second-engineer hire. |
| L.3 | Are customers notified of breaches affecting their data? | **Yes — within 72 hours** | GDPR Art. 33 timeline. Communications template in `INCIDENT_RUNBOOK.md` § Communications. |
| L.4 | Are incidents post-mortemed? | **Yes** | Blameless 5-whys post-incident template in `INCIDENT_RUNBOOK.md` § Post-incident. Action-items tracked publicly via GitHub issues. |
| L.5 | Is forensic capability available? | **Yes** | CloudTrail multi-region trail with file-validation enabled, 7-year retention (Phase 9b). In-app AuditEvent log with actor IP + UA (Phase 4b). |

## M. Business Continuity & Disaster Recovery

| # | Question | Answer | Evidence |
|---|---|---|---|
| M.1 | Is there a disaster-recovery plan? | **Partial** | DynamoDB PITR enables point-in-time restore for 35 days. CDK is the source of truth for infra so a region rebuild is `cdk deploy` away. Formal DR runbook with RTO/RPO statements: roadmap. |
| M.2 | What are the documented RTO and RPO? | **RTO 4 hours, RPO 1 hour (target)** | Targets only — not yet validated in a drill. CDK redeploy + DynamoDB PITR support these targets technically. |
| M.3 | Is the service available during single-AZ failure? | **Yes** | All managed services (Lambda, DynamoDB, S3, API Gateway, Cognito, SES) are multi-AZ by AWS default in us-east-1. |
| M.4 | Is there a multi-region failover? | **No** | Single-region deployment in us-east-1. Cross-region failover roadmap. |
| M.5 | Is there a public status page? | **Yes** | Phase 8c shipped at `https://status.rivalscan.com` (S3 + CloudFront + Lambda auto-updater driven by CloudWatch alarms). |

## N. Application & Interface Security

| # | Question | Answer | Evidence |
|---|---|---|---|
| N.1 | Is there a public API? | **Yes — read-only** | Phase 11 ships `/v1/competitors`, `/v1/changes`, `/v1/recommendations` with `X-API-Key` auth. Per-key 60 req/min throttle. Tier-gated to Strategist+ plans. See `PUBLIC_API.md`. |
| N.2 | How are API keys managed? | **sha256-hashed at rest, plaintext returned once** | Workspace owner-only minting. Audit-logged on creation + revocation. Revocation is immediate — both double-write rows are deleted in parallel. |
| N.3 | Are API webhooks signed? | **Yes — HMAC-SHA256** | Customer-provided webhook URLs (Phase 3) get a per-user HMAC signing secret. Slack webhooks rely on URL secrecy (industry standard). |
| N.4 | Are API requests logged? | **Yes** | CloudWatch logs every API Gateway + Lambda invocation. Audit events for owner-mutating actions retained 90 days in DynamoDB plus 7 years in CloudTrail. |

## O. Threat & Vulnerability Management

| # | Question | Answer | Evidence |
|---|---|---|---|
| O.1 | Is vulnerability scanning performed? | **Yes (dependencies)** | Phase 9b: weekly `npm audit --audit-level=high` for both Backend + Frontend; Dependabot weekly grouped PRs. CI fails on high/critical. |
| O.2 | Is penetration testing performed? | **Roadmap** | External pen test scheduled for Phase 7.6 (`COMPLIANCE_ROADMAP.md`); typically a SOC 2 Type 2 prerequisite. |
| O.3 | Is there a vulnerability disclosure policy? | **Yes** | `https://app.rivalscan.com/.well-known/security.txt` per RFC 9116. Inbound `security@` mailbox monitored. |
| O.4 | Is a bug bounty program offered? | **No** | Disclosure via `security@` is the channel. Bug bounty deferred until customer base + budget warrant. |
| O.5 | Is threat modeling performed for new features? | **Partial** | Each major phase plan in `PRODUCT_GAPS_ROADMAP.md` and `COMPLIANCE_ROADMAP.md` includes a "Risks" section. Formal STRIDE / PASTA: roadmap. |

---

## How to use this document

1. **Procurement teams**: this is the standard answer set. For questionnaire-on-paper requests, copy the relevant rows.
2. **Sales engineering**: link prospects to the public-safe summary (`SECURITY_OVERVIEW.md`) first; share this full file under NDA.
3. **Auditors / compliance**: use the "Evidence" pointers as the index into the source-of-truth artifacts (`INCIDENT_RUNBOOK.md`, `SECRET_ROTATION_RUNBOOK.md`, `ACCESS_REVIEW_RUNBOOK.md`, `VENDOR_RISK_REGISTER.md`, `CHANGE_MANAGEMENT_POLICY.md`, `Backend/scripts/soc2-evidence-snapshot.sh`).
4. **When phases ship**: update the relevant rows. Every "Roadmap" answer is a watch-list item.

Last reviewed: **2026-05-07** by the workspace owner.
