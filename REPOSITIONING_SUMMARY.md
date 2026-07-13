# Repositioning Summary — Competitor Analysis → Cross-Check (Bidirectional) Analysis

> Companion to [PLAN.md](PLAN.md). 15 commits, one per surface. Every change verified:
> frontend `tsc --noEmit` + ESLint + production build clean; backend `tsc --noEmit` + 108/108
> vitest tests passing; `git diff` on `PLAN_LIMITS` / `CAPABILITIES` (both backend and the
> frontend mirror) is **empty** — no price, limit, or gating value changed; all AI-disclaimer
> strings preserved (one **added**, to the critical-alert email which had none).

## The frame, in one line

Kironyx no longer describes itself as a tool that watches competitors. It describes itself as a
mirror: **the same AI research runs on your competitors and on your own brand, and every surface
shows the gap** — "competitive self-awareness", always paired with the clarifier "competitive
intelligence + brand monitoring in one".

## What changed, by surface

### Frontend (commits: landing, pricing, SEO, onboarding, IA, matrix, brand/methodology)

| Surface | Before | After |
|---|---|---|
| Hero H1 | "Know what your competitors **did this week** — automatically" | "Know what your competitors did this week — **and exactly where you stand**" |
| Hero badge | "AI-Powered Competitive Intelligence" | "Competitive intelligence + brand monitoring in one" |
| Feature card | "Daily Monitoring — Automated daily scraping…" *(stale)* | "Your Brand, Same Engine — Brand Pulse runs the identical deep research on you… on every plan" |
| Feature card | "Real-Time Alerts — instant email alerts" *(stale)* | "Same-Day Alerts — an email lands the day we find it" |
| How-it-works step 2 | "AI Monitors Daily — scrapes your competitors every day" *(stale)* | "AI Researches Everyone Weekly — deep research… for each competitor and for your own brand" |
| FAQ | — | New: "**Do you monitor my own brand too?**" (Brand Pulse on every plan) |
| Pricing tiers | "3 competitors" / "Daily strategic digests" *(stale)* / "Real-time alerts" *(stale)* | "Stay ahead of 3 competitors — benchmarked against your own brand" / "Weekly strategic digest + audio briefing" / "Monthly executive PDF briefings"; every tier gains "**Brand Pulse self-monitoring included**"; API access moved to Strategist where it actually unlocks |
| SEO title | "Kironyx — AI Competitive Intelligence for SMBs" | "Kironyx — AI Competitive Intelligence & Brand Monitoring for SMBs" (hybrid keeps the searched keyword) |
| Onboarding Pages step | "We'll detect changes on these pages daily." *(stale)* | Focus-area framing; weekly + on-demand research cadence |
| Onboarding toast | "Your competitors are being scanned." | "Deep research is running on your competitors — and on your brand." (conditional: only when a website was provided) |
| Dashboard header | "Your competitive intelligence feed" | "Competitor moves, your position, and the gap between them" |
| Your Brand page | "How the market is talking about you." | "…— and how that compares to your set." Empty state: "Turn the engine on yourself" |
| Methodology | Momentum/signals described competitors only | "tracked company — competitors and your own brand alike"; new note: threat is never scored for your own brand; intro states self-brand scores come from the identical research cycle. **All formulas/rubrics verbatim.** |

### The IA change

- Sidebar reads **Dashboard → Your Brand → How You Stack Up** (renamed from "Compare", moved
  above Recommendations) as the product's core loop; Share of Voice stays nested under it.
- Dashboard home renders the **Brand Health card before the ranked competitor strip** (mirror
  first, field second). `data-tour` anchors untouched — the first-run tour still works.

### The one functional change — matrix "You" row (commit `feat(compare)`)

The matrix endpoint already returned the self-brand row undistinguished. The frontend now matches
it by id against `GET /brand`, **pins it to the top as the reference line, badges it "You"**
(emerald, matching the Share-of-Voice self-series convention), and routes its click to
`/dashboard/your-brand` — fixing a latent 404 (the competitor-detail endpoint refuses self rows
by design). Workspaces without brand setup behave exactly as before. No backend changes.

### Emails (2 commits)

| Email | Before | After |
|---|---|---|
| Weekly digest subject | "Your Weekly Competitive Brief — {range}" | "**What your competitors did this week** — {range}" (honest: the digest's data is competitors-only) + a Brand Pulse cross-link block ("the other side of the mirror") |
| Comparative brief subject | "Your Comparative Brief — {range}" | "**Where you stand this week** — {range}"; section retitled "You vs. the field" |
| Footer taglines | Digest: "AI Competitive Intelligence…" / Brief: "AI Market Intelligence…" (inconsistent) | Both: "Kironyx — AI competitive intelligence + brand monitoring for SMBs" |
| Critical alert | No disclaimer footer | Standard AI disclaimer **added** + "See where you stand: Brand Pulse" line |
| Retention nudge | "Your competitors haven't been resting" | "Your market hasn't stood still… see what moved, and where you now stand" (also more accurate — the count includes self-coverage rows) |
| Invitation | "…tracks your competitors and surfaces strategic insights" | "…runs the same AI research on your competitors and your own brand, and shows the team side by side where you stand" |

### Documents (5 commits)

- **PRODUCT_OVERVIEW.md** — opener now "competitive self-awareness… competitive intelligence and
  brand monitoring in one engine… Not a spy tool: a mirror." The problem section gains the
  one-directional gap as a fourth failure mode; Brand Pulse loses the "reframed as media
  intelligence" secondary voice; new "vs. two separate tools" differentiation bullet; pricing
  closer inverts to "self-awareness isn't an upsell — the comparison is the product." Trust /
  compliance / "What Kironyx isn't" sections untouched. (Also fixed a stray "Wha" typo.)
- **docs/internal/BUSINESS_SCOPE.md** — **new**, successor to the deleted `Initial_Plan.md`
  (recovered from git history). Comparative model as the centerpiece; market figures carried with
  explicit ⚠ 2025 staleness caveats; tier ladder rebuilt from `PLAN_LIMITS`/`CAPABILITIES`;
  Paddle replaces the Stripe discussion; never-shipped "daily digests / real-time alerts /
  priority support" promises dropped; current CDK architecture; obsolete scraping risk removed.
  Indexed in docs/README.md and the CLAUDE.md doc map.
- **docs/internal/PRICING_VALUE_REPORT.md** — §4.2 retitled "The comparative core"; §5's "Brand
  Pulse is a wedge feature" inverted to "half the product's core promise". All tables and gating
  mechanics verbatim.
- **One-liners** — README leads with competitive self-awareness; CLAUDE.md project overview names
  Brand Pulse + side-by-side benchmarking (one sentence); PUBLIC_API.md fixes the stale
  "read-only" claim; SECURITY_QUESTIONNAIRE's service-description cell gains "brand-monitoring"
  (descriptive metadata only — no control answers, no review-date bump).
- **Presentation/index.html** — the deck **finally drops the pre-rebrand "RivalScan" hero**
  (wordmark accent matches the app: Kironyˣ). New "Not a spy tool. A mirror." slide
  (Differentiator 01, deck is now 13 slides); pricing slide keeps every number but corrects
  factually-wrong bullets to the real capability matrix; taglines now bidirectional.
- **docs/demo/** — two report files renamed to drop "rivalscan" (`git mv`, content untouched —
  the reports already model the bidirectional voice). Zero in-repo references to the old names.

## Findings along the way

- **A reported bug that wasn't:** planning flagged a broken `<\a><\p>` citation anchor in the
  alert email — verification showed the HTML was already valid, so no "fix" was applied.
- **A real latent bug fixed:** clicking the self-brand row in the comparator matrix navigated to
  a route that 404s by design; it now routes to Brand Pulse.

## Accepted limitations / follow-ups (your call, none blocking)

1. **Matrix CSV export** still emits the self row with no "You" marker — distinguishing it needs
   a backend field on the export payload (out of scope for this pass).
2. **Threat filters hide the "You" row** (self is never threat-scored). Explained via the new
   methodology note; special-casing it was deliberately avoided.
3. **Slack digest adapter copy** still says "Weekly Competitive Brief" — not updated (the brief's
   email subject changed); worth a follow-up if Slack copy should track the email.
4. **Support bullets on the web pricing page** ("Priority support" / "Dedicated support") were
   kept — they read as service commitments rather than product gating. The deck's "Priority
   support" was dropped per the approved stale-claims decision. Decide whether the web page
   should match the deck.
5. **Retention-nudge change count** includes self-brand coverage rows (backend query is
   unfiltered); the new "your market" wording absorbs this, but a backend filter would make the
   number strictly competitor-only.
6. **"Competitive self-awareness" as a coined category** — house rule adopted in copy and
   BUSINESS_SCOPE.md §9: never lead with the coined term without the "competitive intelligence +
   brand monitoring in one" clarifier.
