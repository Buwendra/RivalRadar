# Kironyx — Business Scope

> **Audience:** Internal product / strategy.
> **Provenance:** Successor to `Initial_Plan.md` (deleted from the working tree; retrievable via
> `git show b77e027:Initial_Plan.md`). That document scoped the original build — pre-rebrand,
> pre-pivot, one-directional competitor monitoring on a Firecrawl/Railway/Supabase/Stripe stack.
> This rewrite (July 2026) describes the business around the **shipped** product and its
> **comparative positioning**.
> **Caveat:** Market figures marked ⚠ are carried over from the original mid-2025 research and
> have not been re-verified — treat them as directional, not citable.

---

## 1. Executive summary

Kironyx is a **competitive self-awareness** SaaS for SMBs — competitive intelligence and brand
monitoring in one engine. One Claude-powered deep-research pipeline runs on the customer's
competitors *and* on their own brand, benchmarks both sides in the same tables (share of voice,
brand health, comparator matrix), and delivers one weekly briefing that answers the question the
category has historically dodged: *where do we stand?*

It is priced at **$49–$199/month** to fill the gap between free tools that drown users in noise
(Google Alerts, RSS) and enterprise platforms that cost more than a junior salary (Crayon and Klue
typically start at $20,000+/year, plus the analyst to operate them). The buyer is a founder,
PMM/GTM lead, or PR/comms lead at a company of roughly 10–200 people — someone who would hire a
competitive analyst if the company could afford one.

The core differentiator is structural, not cosmetic: the self-brand row (**Brand Pulse**) flows
through the identical research pipeline as every competitor and ships on **every tier**. A
one-directional competitor tracker tells you what *they* did; a separate brand tool tells you how
*you* are covered; Kironyx puts both in one ranked table, so every insight arrives as a gap, not
a headline.

## 2. Market opportunity

Figures below are from the original mid-2025 research pass and are ⚠ unverified since:

- The competitive-intelligence tools market was sized at **~$590M growing ~20% annually** ⚠, with
  the **SME segment growing fastest (~21.5% CAGR)** ⚠.
- **68% of B2B deals face direct competition**, while sales teams rate their competitive
  preparedness at **3.8/10** ⚠ — demand for preparedness outstrips tooling.
- **80% of SMBs** report competitive-intelligence software helps them identify new market
  opportunities ⚠.

The structural observation that motivated the product still holds and is verifiable from public
pricing pages: enterprise CI platforms price for the analyst-equipped mid-market and up, free
tools do not analyze, and the affordable middle is thin.

## 3. Positioning: not a spy tool, a mirror

The category reframe is the heart of the business:

- **Category line:** "competitive self-awareness" — always paired with the recognizable
  clarifier **"competitive intelligence + brand monitoring in one"** for comprehension and SEO.
- **The mental model:** Kironyx is a mirror, not a periscope. Customers don't just see "what
  competitors did" — they see "what competitors did, and exactly how you stack up."
- **The signature contrast:** not *"competitor X raised prices"* but *"competitor X raised
  prices — you haven't. Here's the gap it opens."*
- **The structural proof point:** Brand Pulse is included on **every tier**. Self-awareness is
  not an upsell; the comparison is the product. (See §6 and
  [PRICING_VALUE_REPORT.md](PRICING_VALUE_REPORT.md) §5 for the gating rationale.)
- **Credibility rails:** every finding carries source citations; every AI-generated surface
  carries an AI disclaimer; scores link to a public methodology page with formulas and rubrics;
  confidence badges communicate data volume. The positioning must never outrun the product —
  copy promises the side-by-side *view*, not automated per-change gap calculations.

## 4. Differentiation

The reference points from the original research, updated with the comparative axis. Competitor
pricing is ⚠ mid-2025 data.

| Alternative | What it does | Why Kironyx wins |
|---|---|---|
| Google Alerts / Visualping / RSS | Raw mentions and visual page diffs, no analysis | We triage, score, explain, and recommend — and we include *you* in the picture |
| Competely.ai (~$9–29/mo ⚠) | One-time AI comparison reports | Continuous monitoring with delta detection, not a snapshot |
| RivalSense (~$37–223/mo ⚠) | Weekly briefings, capped company count | Deeper strategic analysis (threat, momentum, predictions) plus the self-brand mirror |
| Crayon / Klue ($20K+/yr ⚠) | Full enterprise CI platforms | Same job at a fraction of the price, no analyst required |
| A CI tool **plus** a brand-monitoring tool | Two subscriptions, two dashboards | One engine, one feed, one digest — both sides ranked in the same tables |

The last row is the new axis: **none of the affordable-tier tools put the customer's own brand in
the same ranked table as their competitors.** Kironyx's Share of Voice, Brand Health Score,
comparator matrix ("You" row pinned as the reference line), and Comparative Weekly Briefing all
do exactly that, from the same research runs the competitor features already pay for.

## 5. Product scope (as shipped)

What the product actually is today — the authoritative architecture reference is
[/CLAUDE.md](../../CLAUDE.md); the feature narrative is
[/PRODUCT_OVERVIEW.md](../../PRODUCT_OVERVIEW.md).

- **AI deep research** (Claude Sonnet + native web search): structured findings across five
  categories — news, product, funding, hiring, social — plus an industry-aware sixth category,
  each finding cited, sentiment- and time-tagged, with a synthesized `derivedState`.
- **Delta detection:** each run compares against the prior baseline and surfaces only what's
  genuinely new, scored 1–10 for significance with implication analysis.
- **Per-competitor enrichment:** momentum trend, threat level with rationale (competitors only —
  never scored for the self brand), derived signal tags, evidence-cited 30/60/90-day predicted
  moves with accuracy grading over time.
- **The comparative core (all tiers):** Brand Pulse self-brand monitoring (coverage feed, 12-week
  sentiment trend), Brand Health Score (0–100 composite with confidence badge), Share of Voice
  (self ranked honestly alongside competitors, overall and per category), and the opt-in
  Comparative Weekly Briefing email.
- **Workflow surfaces:** weekly digest email (+ audio briefing on Strategist+), recommendations,
  battlecards with AI win-against tactics, comparator matrix with the pinned "You" row, saved
  views + subscriptions, search, in-app notifications.
- **Distribution:** Slack alerts, HMAC-signed webhooks, PDF/CSV exports, public `/v1` API
  (read/write, scoped keys), scheduled monthly executive reports (Command).
- **Teams:** multi-seat workspaces with `owner > admin > member` roles, token-based invitations,
  audit log, ownership transfer.
- **Safety and compliance:** pre-research input classifier (rejects person-name and sanctioned
  targets, fail-closed), OFAC SDN screening with drift monitoring, AI disclaimers on every
  generated surface, GDPR export + self-service deletion, public status page.

**Cadence honesty.** Research runs on a **weekly schedule** (fortnightly default on Command,
per-competitor overridable) plus **on-demand** runs, with same-day alert emails when a run
detects a significance-≥7 change. There is **no daily scraping** — the original Firecrawl
daily-snapshot design was removed when Claude deep research became the change-detection engine.
Copy anywhere in the product must not claim daily monitoring or real-time detection.

## 6. Revenue model & tier ladder

Three tiers, a strict superset ladder. Values below are verified against
`Backend/src/shared/types/index.ts` (`PLAN_LIMITS`) and
`Backend/src/shared/types/capabilities.ts` (`CAPABILITIES`) as of July 2026 — those files are
the source of truth if this table drifts. (The per-tier monthly spend ceiling is a money
mechanism and is intentionally omitted, matching the sibling pricing-value report.)

| | Scout $49/mo | Strategist $99/mo | Command $199/mo |
|---|---|---|---|
| Competitors tracked | 3 | 10 | 25 |
| History window | 30 days | 90 days | 365 days |
| Research runs / day | 10 | 30 | 100 |
| Default research cadence | 7 days | 7 days | 14 days |
| **Brand Pulse (self-brand)** | **✓** | **✓** | **✓** |
| Predicted moves | ✓ | ✓ | ✓ |
| Visible recommendations | 3 | 10 | unlimited |
| PDF / CSV exports | — | ✓ | ✓ |
| Slack + webhooks | — | ✓ | ✓ |
| Comparator matrix | — | ✓ | ✓ |
| Public API (keys) | — | ✓ (5) | ✓ (25) |
| Saved views | — | 5 | 25 |
| Seats | 1 | 5 | 25 |
| Custom recommendation focus areas | — | — | ✓ |
| Scheduled monthly reports | — | — | ✓ |

Notes:

- The self-brand row **never consumes a competitor slot** — reinforcing that the mirror is core,
  not metered.
- The original plan's tier table promised "daily digests," "real-time alerts," and "priority
  support"; those were never shipped as described and are **dropped**, not carried forward.
- **Payments: Paddle** (merchant of record — handles global VAT/GST/sales tax). This replaces the
  original Stripe / Lemon Squeezy discussion entirely.
- The original month-by-month MRR projections are dropped; they predate the pivot and the
  rebrand and have no current basis.

## 7. Technical architecture (current)

One paragraph for business context; [/CLAUDE.md](../../CLAUDE.md) is authoritative.

Next.js 14 frontend on AWS Amplify; fully serverless AWS CDK backend (8 stacks): API Gateway
HTTP v2 + Lambda (Node 20, ARM64), DynamoDB single-table, three Step Functions state machines
(ResearchPipeline, WeeklyDigest, ComparativeBriefing), EventBridge schedules, Cognito auth, SES
email, Secrets Manager, CloudWatch/X-Ray with a public status page. AI: Claude Sonnet 4.5 (deep
research with native web search, delta detection, summaries, comparative briefings) and Claude
Haiku 4.5 (threat scoring, input classification, battlecard tactics), with per-user cost caps,
a per-minute token-rate bucket, and a forensic AI audit log. Research cost is roughly $0.30 per
run end-to-end.

Everything in the original stack section — Firecrawl, Railway, Supabase, Vercel, Clerk, Stripe,
Resend, the Python scraping microservice — was removed or replaced during the pivot.

## 8. Go-to-market

Compressed and modernized from the original playbook; the pitch is now bidirectional.

1. **Direct LinkedIn outreach** to founders and marketing leads at 10–200-person companies. The
   pitch: *"It monitors your competitors — and your own brand — with the same AI research, and
   shows you side by side where you stand. A competitive analyst and a brand tracker for
   $99/month instead of $20K/year."*
2. **Product Hunt launch** angle: *"Competitive intelligence that includes you."* The mirror
   framing is the differentiated hook the category doesn't have.
3. **Community seeding** (r/SaaS, Indie Hackers, Show HN) with value-first comparative insights.
4. **SEO**, extending the original high-intent keyword set ("Crayon alternatives," "competitor
   monitoring tool for startups") with the comparative axis: "brand monitoring + competitive
   intelligence," "competitor benchmarking tool," "share of voice tool for startups."
5. **Free comparative report as the lead magnet** — this now literally exists: the sample reports
   in [docs/demo/](../demo/) analyze a prospect's own brand alongside their rivals and are the
   product demo in document form.

## 9. Risks

- ~~Web-scraping reliability~~ — obsolete; there is no scraper. Research quality now depends on
  Claude's web-search coverage, which degrades gracefully (fewer findings) rather than breaking.
- **AI analysis quality / hallucination** (medium probability, high impact). Mitigations are
  shipped, not aspirational: per-finding source citations, AI disclaimers on every generated
  surface, confidence badges keyed to mention volume, a public methodology page, and partial-JSON
  recovery on truncated model output.
- **Research cost / quota abuse** (low probability, medium impact). Mitigated by per-user monthly
  cost caps enforced in real time, per-day research quotas, and an org-level token-rate bucket.
- **Customer acquisition slower than projected** (high probability, medium impact). Unchanged
  from the original assessment. The comparative free report (§8.5) is the lead magnet; pricing
  experiments (founding-member discounts) remain the fallback lever.
- **Category comprehension** (new). "Competitive self-awareness" is a coined category; if used
  without the "competitive intelligence + brand monitoring in one" clarifier it risks confusing
  both buyers and search engines. House rule: never lead with the coined term alone.

## 10. Defensibility

- **Data moat** — every research cycle accumulates baselines, delta history, sentiment
  time-series, and share-of-voice history that a new entrant cannot backfill. The 12-week
  sentiment trend and momentum credibility explicitly require tenure.
- **Positioning moat** (new) — the bidirectional category itself. Copying it requires a
  competitor to rebuild their product around a self-brand row, not just edit marketing copy.
- **Integration moat** — Slack, webhooks, API syncs, and battlecards embedded in a customer's
  sales workflow raise switching costs with each connection.
- **Cost-structure advantage** — low operating costs relative to US-based competitors allow
  sustained aggressive pricing without venture capital (unchanged from the original plan).

The original document's 3-day build plan, hour-by-hour Claude Code prompts, and automation
playbook are intentionally dropped — they were build tactics, long superseded by the repo's
runbooks and CLAUDE.md.
