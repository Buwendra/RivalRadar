# Reposition Kironyx: "Competitor Analysis" → "Cross-Check (Bidirectional) Analysis"

## Context

Kironyx's marketing, IA, and docs frame it as a one-directional competitor-analysis tool, but the bidirectional machinery already exists: Brand Pulse (self-brand monitoring, ungated on all tiers) runs through the identical deep-research engine, Share of Voice ranks the self brand honestly alongside competitors, and the Comparative Weekly Briefing email is genuinely "you vs. your set". This task repositions every surface around the mirror/cross-check model — category reframe from "competitive intelligence" to "competitive self-awareness" (always paired with the clarifier "competitive intelligence + brand monitoring in one" for recognizability/SEO). It is a messaging + IA change with exactly one small functional change (matrix "You" row), plus two incidental bug fixes found during exploration.

**User decisions already made (approved via Q&A):**
1. Recreate the deleted business-scope doc as `docs/internal/BUSINESS_SCOPE.md` (source: `git show b77e027:Initial_Plan.md`).
2. Correct stale claims while rewriting: "Daily Monitoring", "AI Monitors Daily", onboarding "detect changes on these pages daily", pricing "Daily strategic digests"/"Real-time alerts". Reality: weekly scheduled + on-demand Claude deep research, significance-≥7 alert emails sent **the day we detect** a change, Monday digest. This decision also covers the demo deck's factually-wrong tier bullets (Scout "Exports", "Priority support", etc.) — correct copy to match actual gating; **no code values change**.
3. Comparator matrix: frontend-only "You" labeling of the self-brand row.
4. Presentation deck: rebrand (RivalScan→Kironyx) + full reposition.

**Hard guardrails:** no changes to `PLAN_LIMITS` / `CAPABILITIES` values, prices, or gating; Brand Pulse stays ungated; no new backend endpoints/analysis logic; AI disclaimers preserved verbatim; product/repo/stack names unchanged (internal `RivalScan-*`, `rs_`/`rsk_` prefixes, rebrand runbook stay); spelling per-file convention (frontend + internal docs = US English; PRODUCT_OVERVIEW/customer docs = UK English).

**Verified facts copy must respect:** weekly digest data is competitors-only (self rows filtered) — digest copy may cross-link Brand Pulse but must not claim self-vs-set data; alerts fire when research runs, so say "the day we detect it", never "the day it happens"; the product computes side-by-side views (SoV, matrix, comparative brief), not automated per-change gap calculations — copy promises the view, not the math; threat is deliberately never scored for the self row.

**Messaging framework (apply everywhere):** bidirectional as core frame (one engine, one feed, one digest); features→outcomes; mirror vocabulary ("the gap", "how you stack up", "side by side", "benchmark"); Brand Pulse on every tier as proof point; keep credible — no overclaiming.

---

## Part 0 — Deliverables scaffolding

- **Commit 0:** materialize this plan as `PLAN.md` at repo root (acceptance criterion from the brief).
- **Final commit:** write `REPOSITIONING_SUMMARY.md` (what changed by surface, before/after examples of key strings, the IA change, open items).

## Part 1 — Frontend (Next.js, all copy inline JSX; US English)

### 1.1 IA / navigation (`Frontend/src/components/layout/dashboard-sidebar.tsx`, `Frontend/src/app/(dashboard)/dashboard/page.tsx`)
- Sidebar `navItems` reorder/relabel: Dashboard → Your Brand (unchanged, brandPulse-conditional) → **"How You Stack Up"** (rename of "Compare", moved above Recommendations; same `/dashboard/compare` href + icon; Share of Voice stays as sub-item with its existing all-tiers visibility mechanism) → Recommendations → Methodology → Settings. No group headers. The lower "Competitors" list stays — its contrast with "Your Brand" pinned up top *is* the two-pillar IA.
- Empty-competitor hint → "No competitors yet. Add one to see how you stack up."
- Dashboard home: move `{brandPulseEnabled && <BrandHealthScoreCard size="sm" />}` (currently ~line 108) to just **above** the `data-tour="competitor-strip"` div — mirror first, field second. Do not move the `data-tour` anchors (FirstRunTour depends on them). PageHeader description → "Competitor moves, your position, and the gap between them."
- Compare page (`compare/page.tsx`): title "Compare" → "How You Stack Up" in both `MatrixView` and `UpgradeGate`.
- Marketing navbar: no change.

### 1.2 Landing (`Frontend/src/components/landing/*`)
- `hero-section.tsx`: badge → "Competitive intelligence + brand monitoring in one". H1 → **"Know what your competitors did this week — and exactly where you stand."** Subhead → deep research on competitors *and* your own brand weekly, "shows you the gap". Trust markers keep.
- `problem-section.tsx`: lightest touch — keep the 3 cited stat cards; subhead "…Are you the last to know?" → "…Do you know where you stand?"
- `how-it-works-section.tsx`: step 1 → "Add your competitors — and yourself" (website seeds Brand Pulse); step 2 **stale fix** "AI Monitors Daily" → "AI researches everyone weekly" (weekly schedule + on-demand, findings scored 1–10); step 3 → weekly brief of what moved and where you stand + same-day alert emails on high-significance detections.
- `features-section.tsx`: rewrite the 6-card array features→outcomes. Replace the stale "Daily Monitoring" card with the **Brand Pulse proof-point card** ("Your Brand, Same Engine — …on every plan"). "Real-Time Alerts" → "Same-Day Alerts" (significance 7+, "the day we detect it"). "Multi-Competitor Tracking" → "Stay ahead of up to 25 competitors and see exactly where you stand against each"; drop page-scrape phrasing for category language (news, product, funding, hiring, social).
- `faq-section.tsx`: add "**Do you monitor my own brand too?**" Q&A near the top (Brand Pulse on every plan, same engine, feeds the Comparative Brief); "What can I monitor?" gains "…including your own brand". Keep the detection/accuracy Q&As (they carry citation credibility).
- `footer-cta-section.tsx`: H2 → "Stop guessing — about them, or about yourself."
- `public-footer.tsx`: tagline → "Competitive intelligence + brand monitoring in one. Know what your market did this week — and where you stand."

### 1.3 SEO (`Frontend/src/app/layout.tsx`, `(public)/pricing/page.tsx`)
- Root title → `Kironyx — AI Competitive Intelligence & Brand Monitoring for SMBs` (hybrid keeps the searched keyword); description gains "…and exactly where you stand. AI research on them and on you…".
- Pricing metadata + page subhead: add "Brand Pulse self-monitoring is included on every plan."

### 1.4 Pricing tiers (`Frontend/src/components/landing/pricing-section.tsx` `plans` array — wording only, values untouched)
- Every tier gains bullet **"Brand Pulse self-monitoring included"**.
- Scout: "For founders keeping an eye on the competition." → "See where you stand against your first competitors."; "3 competitors" → "Stay ahead of 3 competitors — benchmarked against your own brand".
- Strategist: **stale fix** "Daily strategic digests" → "Weekly strategic digest + audio briefing" (audioBriefing genuinely Strategist+); optionally add "Side-by-side comparison matrix — with you in it" (comparatorMatrix unlocks here).
- Command: **stale fix** "Real-time alerts" → "Monthly executive PDF briefings" (scheduledReports is genuinely Command-only).

### 1.5 Onboarding (`Frontend/src/components/onboarding/step-page-tracking.tsx`, `Frontend/src/app/onboarding/page.tsx`)
- **Stale fix** Pages step: "We'll detect changes on these pages daily." → these choices tell the AI which parts of each competitor's business to watch; research runs weekly + on demand. No page-scraping claims.
- Success toast → "Setup complete! Deep research is running on your competitors — and on your brand." (verified: onboard enqueues the self-brand run). `step-company-info.tsx` is already well-framed — optional light touch only.

### 1.6 Matrix "You" row — the one functional change (`Frontend/src/app/(dashboard)/dashboard/compare/page.tsx` only)
- In `MatrixView`: `const { data: brand } = useBrand()` (`Frontend/src/lib/hooks/use-brand.ts`); match `row.id === brand?.id` — **exact id equality verified** (self brand is a Competitor row; `GET /brand` returns its id; matrix returns it as an ordinary row).
- Pin self row to index 0 in the `rows` useMemo (partition, sort rest, prepend). Render a "You" `Badge` in the name cell using the emerald self-color convention from `share-of-voice-chart.tsx` + subtle row tint.
- **Bug fix:** reroute the self row's click to `/dashboard/your-brand` (currently navigates to `/dashboard/competitors/{id}` which 404s by design).
- Edge cases: no self brand → behaves exactly as today; threat filter hides the unscored self row (accepted, documented); Scout gate untouched; CSV export still emits self undistinguished (accepted v1 limitation — backend change out of scope).

### 1.7 Brand / methodology copy (`your-brand/page.tsx`, `Frontend/src/lib/content/methodology.ts`, `methodology/page.tsx`)
- Your Brand loaded-state description → "How the market is talking about you — and how that compares to your set." Empty-state headline punch-up ("Turn the engine on yourself.").
- Methodology: **all formulas, rubrics, provenance badges verbatim.** `momentum`/`signals` one-liners: "a competitor's" → "a tracked company's — competitors and your own brand alike". Add a threat note: "Threat is only scored for competitors — Kironyx never scores your own brand as a threat to you." Page intro gains one sentence: self-brand scores come from the identical research cycle.
- Competitor detail page: **no changes** (a self-comparison panel would be a new analysis surface — out of scope).

## Part 2 — Emails (Backend, inline HTML per handler)

- **Unify footer tagline** across digest + comparative brief: "Kironyx — AI competitive intelligence + brand monitoring for SMBs". Disclaimer lines byte-identical.
- Weekly digest (`Backend/src/functions/scheduled/render-send-email.ts`): subject → `What your competitors did this week — ${dateRange}` (accurate: competitor data only); lead line "Here's what moved on the competitor side of your market this week."; add a small cross-link block above the CTA: "The other side of the mirror — how you're covered, and where you broke through — lives in Brand Pulse." → `${FRONTEND_URL}/dashboard/your-brand` (link the page, not the opt-in email).
- Comparative brief (`render-send-comparative-brief.ts`): subject → `Where you stand this week — ${dateRange}`; heading "Comparative briefing" → "You vs. the field"; sections/CTA keep.
- Alerts (`Backend/src/shared/services/notifier.ts` `dispatchCriticalAlert`): keep subject; add the standard AI-disclaimer footer line (verbatim text, additive); **bug fix** the broken `<\a><\p>` citation anchor (~line 139) in the same commit.
- Retention nudge (`send-retention-nudges.ts`): "Your competitors haven't been resting…" → "Your market hasn't stood still — …see what moved, and where you now stand." ("market" is also more accurate: the count includes self-coverage rows).
- Invitation (`Backend/src/functions/api/workspaces/invite.ts`): body → "…runs the same AI research on your competitors and your own brand, and shows the team side by side where you stand each week."
- Monthly report (`send-scheduled-reports.ts`): subject stays (accurately competitor-focused); optional one body line pointing at Brand Pulse.
- Slack adapter copy: out of scope, listed as follow-up in the summary doc.

## Part 3 — Documents

### 3.1 `PRODUCT_OVERVIEW.md` (UK English; ~70–90 lines touched)
- "At a glance" opener → "Kironyx is competitive self-awareness for teams that don't have an analyst: competitive intelligence and brand monitoring in one engine. Tell us who your competitors are — and who you are — …sourced, scored, side by side." Keep the free-vs-enterprise pricing paragraph verbatim.
- "The problem we exist for": keep 3 failure modes, add the fourth beat (existing tools are one-directional; nobody puts both in one table).
- "Who it's for": PR/comms persona becomes first-class; thread "the gap" into the founder persona.
- Scenarios: append gap-framing to scenario 1; scenario 4 drops "reframed as media intelligence" → "the mirror half of the product". Feature facts unchanged.
- Brand Pulse section: replace the "reframed as" sentence → "…because the sharpest competitive question isn't 'what are they doing?' but 'how do we stack up?'. Not a spy tool: a mirror."
- "How Kironyx is different": add one comparison bullet (vs running two separate tools; no named brand-monitoring competitors).
- "Pricing in plain English": mechanics exact; only the closing line inverts to "self-awareness isn't an upsell — the comparison is the product."
- **Keep verbatim:** How-it-works mechanics (one clause added), Teams/roles, Trust/safety/compliance, "What Kironyx isn't" (all 4 exclusions), Getting started. Fix the pre-existing stray "Wha" typo (~line 240).

### 3.2 `docs/internal/PRICING_VALUE_REPORT.md` (US English; ~20–25 lines)
- §4.1: add one sentence — the identical pipeline runs on the workspace's own brand; bidirectional by design.
- §4.2: retitle → "The comparative core — all tiers"; Brand Pulse bullet drops "reframed as media intelligence" → "the second half of the product's bidirectional core, not an add-on."
- §5 first bullet inversion: "Both are wedge features." → Brand Pulse ships everywhere because it's half the core promise; PR/comms persona + absorbable compute stay as supporting points. §6 "brand-monitoring wedge" → "comparative core".
- **Keep verbatim:** money-omission disclaimers, §2 tables, §3 gating mechanics, §4.3–4.5, remaining §5 bullets.

### 3.3 New `docs/internal/BUSINESS_SCOPE.md` (US English, ~200–240 lines)
Source structure from `git show b77e027:Initial_Plan.md`; header notes provenance + "market figures ⚠ carried from mid-2025 research, not re-verified". Sections: 1) Executive summary (rewritten around the comparative model; drop "3 focused days" claims); 2) Market opportunity ($590M/20%, 21.53% CAGR, 68%/3.8 — all ⚠-flagged); 3) **Positioning: not a spy tool, a mirror** (new centerpiece); 4) Differentiation (keep Google Alerts/Competely/RivalSense/Crayon reference points, ⚠ 2025 prices; add: no affordable tool puts you in the same ranked table); 5) Product scope as shipped (incl. cadence-honesty subsection: no daily scraping); 6) Revenue model + tier ladder **rebuilt from `Backend/src/shared/types/index.ts` PLAN_LIMITS + capabilities** (omit monthlyCostCap; Paddle replaces Stripe discussion; drop MRR projections); 7) Current architecture (CDK/Lambda/DynamoDB/Step Functions/Claude; pointer to CLAUDE.md); 8) GTM modernized + compressed (bidirectional pitch; demo reports as lead magnet); 9) Risks (drop scraping risk; keep AI-quality with shipped mitigations; add cost/quota risk); 10) Defensibility (data moat via research baselines/SoV time series; positioning moat; integrations). Drop the 3-day build plan / hour-by-hour prompts entirely.
- Add index row in `docs/README.md`; widen CLAUDE.md doc-map parenthetical for `/docs/internal/`.

### 3.4 One-liners
- `README.md` line 3: lead with "Competitive self-awareness for SMBs — AI competitive intelligence + brand monitoring in one engine…". Prices untouched.
- `CLAUDE.md` Project Overview: one-sentence splice adding self-brand/side-by-side; nothing technical shifts.
- `docs/api/PUBLIC_API.md` line 3: fix stale "Read-only" (doc itself documents write scope) → "Programmatic read/write access to your workspace's intelligence — competitors and your own brand alike." Tier availability line unchanged.
- `docs/security/SECURITY_QUESTIONNAIRE.md` vendor-profile cell only: → "AI-powered competitive-intelligence and brand-monitoring SaaS for SMBs". Do **not** bump "Last reviewed" date; nothing else in security docs changes.

### 3.5 `Presentation/index.html` (US English; 12 → 13 slides; nav JS counts slides dynamically — no JS changes)
- Slide 1: H1 `Rival<span class="accent">Scan</span>` → `Kirony<span class="accent">x</span>` (accent only the final X, matching commit 2294dc0); chip → "Competitive Intelligence + Brand Monitoring"; tagline → "Your competitors, your brand, side by side — strategic intelligence for the rest of us." (mirrored on the closing slide).
- **New slide 4 "The Mirror"** (Differentiator · 01): "Not a spy tool. A mirror." — three cards: Brand Pulse / Share of Voice / Comparative Weekly Briefing (all verified real), accent strip "Included on every tier — self-awareness isn't an upsell." Renumber subsequent Differentiator chips 01–06 → 02–07 manually.
- Briefings slide: swap example quote for the signature gap line ("Acme raised prices 15%. You haven't. Here's the gap it opens…").
- Deep-research slide: add "The same engine runs on your own brand."
- Integrations slide accuracy fix: "Scheduled reports — Custom cadence, custom recipients" → "Monthly executive PDF, delivered hands-off."
- Demo-flow slide: insert a "How you stack up" step; renumber timeline dots.
- Pricing slide: **numbers untouched**; add footnote "Brand Pulse — self-brand monitoring — on every tier"; correct the factually-wrong bullets to match the real capability matrix (Scout: 3 competitors · 30-day history · Brand Pulse + predicted moves · weekly briefing; Strategist adds exports/Slack/webhooks/API/matrix; Command adds custom focus areas/scheduled reports/unlimited recs). Drop never-shipped "Priority support".

### 3.6 Demo file renames (safe — zero in-repo references, verified)
`git mv docs/demo/citrus-leisure-rivalscan-report.md docs/demo/citrus-leisure-report.md` and `git mv docs/demo/doc990-rivalscan-report.md docs/demo/doc990-report.md`. Content untouched (already on-message).

---

## Phasing (one commit per surface)

| # | Commit | Files |
|---|---|---|
| 0 | `docs: add repositioning PLAN.md` | PLAN.md (this plan) |
| 1 | `copy(landing): reposition to bidirectional cross-check; fix stale daily-monitoring claims` | 7 landing components + public-footer |
| 2 | `copy(pricing): outcome-framed tiers, Brand Pulse on every plan; fix stale daily/real-time bullets` | pricing-section.tsx, pricing/page.tsx |
| 3 | `copy(seo): root metadata — competitive intelligence + brand monitoring` | app/layout.tsx |
| 4 | `copy(onboarding): accurate weekly-research cadence; research-both-sides toast` | step-page-tracking.tsx, onboarding/page.tsx |
| 5 | `ia(dashboard): promote self-brand pillar — rename Compare to How You Stack Up, lift Brand Health card` | dashboard-sidebar.tsx, dashboard/page.tsx, compare/page.tsx (title) |
| 6 | `feat(compare): badge + pin self-brand row as "You"; route its click to Brand Pulse` | compare/page.tsx |
| 7 | `copy(dashboard): self-brand reads first-class in Brand Pulse and methodology` | your-brand/page.tsx, methodology.ts, methodology/page.tsx |
| 8 | `copy(email): digest is the competitor side, comparative brief is the mirror; unify footer tagline` | render-send-email.ts, render-send-comparative-brief.ts |
| 9 | `copy(email): bidirectional alert/nudge/invite copy; add alert disclaimer; fix broken citation anchor` | notifier.ts, send-retention-nudges.ts, invite.ts, send-scheduled-reports.ts |
| 10 | `docs(positioning): reframe product overview around bidirectional competitive self-awareness` | PRODUCT_OVERVIEW.md |
| 11 | `docs(positioning): align top-level positioning lines with the comparative model` | README.md, CLAUDE.md, PUBLIC_API.md, SECURITY_QUESTIONNAIRE.md |
| 12 | `docs(internal): reframe pricing-value report around the comparative core` | PRICING_VALUE_REPORT.md |
| 13 | `docs(internal): add BUSINESS_SCOPE.md — comparative-model successor to Initial_Plan.md` | BUSINESS_SCOPE.md, docs/README.md, CLAUDE.md doc-map row |
| 14 | `deck: rebrand RivalScan -> Kironyx and reposition around the mirror narrative` | Presentation/index.html |
| 15 | `docs(demo): drop legacy 'rivalscan' from demo report filenames` | 2 × git mv |
| 16 | `docs: repositioning summary` | REPOSITIONING_SUMMARY.md |

## Verification

- After frontend commits (1–7): `cd Frontend && npx tsc --noEmit && npm run lint && npm run build`.
- After backend commits (8–9): `cd Backend && npm run lint && npm test` (no tests assert email copy — verified; digest-resilience.test.ts mocks the dispatcher).
- Guardrail tripwire after every commit (must print nothing): `git diff <base>..HEAD -- Backend/src/shared/types/index.ts Backend/src/shared/types/capabilities.ts Frontend/src/lib/utils/capabilities.ts Frontend/src/lib/utils/plan-limits.ts`.
- Disclaimer check: `grep -rn "AI-generated analysis. May contain errors" Backend/src Frontend/src` — count must not decrease (alerts commit increases it by one, intentionally).
- Manual smoke (commits 5–6): Strategist workspace with self brand → matrix shows pinned "You" row, click lands on `/dashboard/your-brand`; workspace without self brand → matrix behaves exactly as today; Scout → upgrade gate with new copy.
- Deck: open Presentation/index.html in a browser; check slide count/progress bar, chip renumbering, no "RivalScan" remains (`grep -i "rival" Presentation/index.html` → only expect none).

## Accepted limitations / follow-ups (documented in REPOSITIONING_SUMMARY.md)

- Matrix CSV export still emits the self row undistinguished (backend field needed — out of scope).
- Threat filter hides the "You" row (self is never threat-scored — explained via the new methodology note).
- Slack digest adapter copy not updated (follow-up).
- Retention-nudge change count includes self-coverage rows (the "your market" wording absorbs this; a backend filter would be a logic change).
