# Documentation index

Everything that isn't `/CLAUDE.md`, `/PRODUCT_OVERVIEW.md`, or `/README.md` lives under here.

**Status legend** (used across the roadmap docs):

- ✅ Shipped — in production
- 🚧 In flight — actively being built (or partial)
- 📋 Planned — scheduled, not started
- 💤 Deferred — parked (often to [PRODUCT_GAPS_ROADMAP.md](roadmaps/PRODUCT_GAPS_ROADMAP.md) Phase 11 — Go Live)

---

## Roadmaps

What's planned, what's shipped, what's deferred. Each roadmap doc carries the status legend at the top and a status badge on every phase heading.

| Doc | Purpose | Audience |
|---|---|---|
| [roadmaps/ROADMAP.md](roadmaps/ROADMAP.md) | Predictions & Tags — Phases 0–5 (all ✅ shipped). Threat level, momentum, tag chips, predicted moves, dashboard polish. | Product, engineering |
| [roadmaps/PRODUCT_GAPS_ROADMAP.md](roadmaps/PRODUCT_GAPS_ROADMAP.md) | Structural gaps — Phases 1–11. Currently: 1–8 ✅, 9 🚧 (~80%), 10 💤, 11 🚧 (Go Live parking lot). | Product, engineering |
| [roadmaps/COMPLIANCE_ROADMAP.md](roadmaps/COMPLIANCE_ROADMAP.md) | Legal / regulatory / security posture — Phases 1–7. Currently: 1 ✅, 2–5 🚧, 6 📋, 7 💤. | Engineering, legal, compliance |
| [roadmaps/PREDICTIONS_AND_TAGS.md](roadmaps/PREDICTIONS_AND_TAGS.md) | Ideation source for the ROADMAP.md work above. Most ideas have shipped. Retained as a strategy / ideation record. | Product |

## Launch readiness

| Doc | Purpose | Audience |
|---|---|---|
| [LAUNCH_ISSUES.md](LAUNCH_ISSUES.md) | Deep-dive on every identified issue that affects opening public signups, with programmatic fix plans (file paths, code outlines, verification, effort). 11 issues across legal, security, ops, and tech debt. | Engineering, product, legal |

## Runbooks

How to operate the system — deploy, test, page response, secret rotation.

| Doc | Purpose | Audience |
|---|---|---|
| [runbooks/DEPLOYMENT.md](runbooks/DEPLOYMENT.md) | Step-by-step deploy of Backend (CDK) and Frontend (Amplify) from a clean machine. | Engineering, ops |
| [runbooks/TESTING.md](runbooks/TESTING.md) | End-to-end smoke tests, especially for SES + research pipeline. | Engineering, QA |
| [runbooks/INCIDENT_RUNBOOK.md](runbooks/INCIDENT_RUNBOOK.md) | Severity definitions, on-call escalation, response playbooks for the 5 most common incidents. | On-call |
| [runbooks/SECRET_ROTATION_RUNBOOK.md](runbooks/SECRET_ROTATION_RUNBOOK.md) | Quarterly cadence + emergency-leak procedure for the `rivalscan/api-keys` Secrets Manager entry. | Engineering, ops |

## Security

Posture, policy, and audit material for B2B procurement security questionnaires.

| Doc | Purpose | Audience |
|---|---|---|
| [security/SECURITY_OVERVIEW.md](security/SECURITY_OVERVIEW.md) | One-page security posture summary — architecture, data classification, encryption. | Prospects, procurement |
| [security/SECURITY_QUESTIONNAIRE.md](security/SECURITY_QUESTIONNAIRE.md) | Pre-filled answers to the common B2B procurement security Q&A (Vanta / SecurityPal style). | Prospects, procurement |
| [security/VENDOR_RISK_REGISTER.md](security/VENDOR_RISK_REGISTER.md) | Sub-processor / vendor risk assessment (Anthropic, Paddle, AWS, GitHub, etc.). | Compliance, audit |
| [security/ACCESS_REVIEW_RUNBOOK.md](security/ACCESS_REVIEW_RUNBOOK.md) | Quarterly access review (who has AWS / Paddle / GitHub admin). | Compliance, owner |
| [security/CHANGE_MANAGEMENT_POLICY.md](security/CHANGE_MANAGEMENT_POLICY.md) | Code review + testing + deployment gate + rollback policy (SOC 2 CC8.1). | Engineering, audit |

## API

External-developer references.

| Doc | Purpose | Audience |
|---|---|---|
| [api/PUBLIC_API.md](api/PUBLIC_API.md) | Read/write public API reference — X-API-Key auth, scopes, endpoints, payloads. | API integrators |

## Internal

Material intentionally NOT public.

| Doc | Purpose | Audience |
|---|---|---|
| [internal/PRICING_VALUE_REPORT.md](internal/PRICING_VALUE_REPORT.md) | Tier-by-tier capability + plan-limit analysis. Deliberately excludes pricing figures — those live in code (`PLAN_LIMITS`) and the public marketing site. | Internal team only |

---

## Known doc-quality TODOs

- **Unified phase numbering** across the three roadmaps. Today: ROADMAP.md uses 0–5, PRODUCT_GAPS_ROADMAP.md uses 1–11, COMPLIANCE_ROADMAP.md uses 1–7, and `CLAUDE.md` references a master timeline that spans all three (Phases 1–24+). Renumbering needs careful cross-ref work; tracked here so it isn't lost.
- **Capabilities Matrix consolidation** — `Backend/src/shared/types/capabilities.ts` and `Frontend/src/lib/utils/capabilities.ts` are duplicated by hand. Worth generating one from the other.
- **AI audit log scope verification** — COMPLIANCE Phase 1.5 describes a full audit log (`aiCallId`, `aiPromptHash`, `aiResponseText`); the current `ai_call_completed` CloudWatch log line is partial. Status badge on Phase 1 is currently ✅ — a follow-up should clarify whether the gap matters.
