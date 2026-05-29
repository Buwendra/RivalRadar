# RivalScan — Product Overview

## At a glance

RivalScan is competitive intelligence for teams that don't have a competitive-intelligence
analyst. Tell us who your competitors are; we research the open web every week, surface
only what's actually changed and matters, and tell you what to do about it. The result
is one Monday-morning briefing — sourced, scored, and short — that replaces a Sunday
spent Googling competitors.

It's built for the gap between *free tools that drown you in noise* (Google Alerts, RSS)
and *enterprise platforms that cost more than a junior salary* (Crayon and Klue typically
start at $20,000+/year, plus the analyst to operate them).

---

## The problem we exist for

Most teams under 200 people don't track competitors well. Not because they don't care —
the data says competitive deals are won by the better-prepared side and most teams rate
their own preparedness at under four out of ten — but because the tools available either
don't work or aren't affordable.

**Google Alerts and RSS** push raw mentions at you. There's no filtering, no scoring, no
synthesis. You read thirty alerts to find one useful signal. After the second week most
people stop reading.

**Crayon, Klue, Kompyte** are excellent platforms aimed at a different buyer. They start
around $20,000–$30,000/year and assume an internal analyst whose job is to feed them and
brief the rest of the company. Below 200 employees, both of those costs are usually
deal-breakers.

**The DIY answer** — someone on the team spending two hours every Friday searching for
what competitors are doing — works for a while, then doesn't, because nobody owns it, the
searching is inconsistent, and the synthesis lives in one person's head.

RivalScan exists to give SMB teams the *outcome* of an enterprise CI program — a weekly
briefing with the things that matter — without the price tag or the headcount.

---

## Who it's for

We're built for three roles you'll often find at companies between 10 and 200 people. A
workspace usually serves more than one of them.

**Founders and product leads at SaaS or tech companies.** You feel the market move and
worry you don't know fast enough. You want to know when a competitor raises, ships, or
repositions, and you want to know within days — not when a customer mentions it on a
sales call. You don't have time to read fifty sources a week.

**Marketing, PMM, and GTM leads operationalising competitive intel.** You need to brief
the sales team weekly with real signal, not Slack scraps. You want exports, integrations,
a saved view per persona, and the ability to send a battlecard to a rep two minutes after
they ask. You're the person who'd hire a competitive analyst if the company could afford
one.

**PR, comms, and brand leads.** You care less about what competitors are *building* and
more about how the *market* is talking about your brand versus theirs. You want a
sentiment trend, a share-of-voice number, and a PR-flavoured briefing of where the
narrative is. Our Brand Pulse surface is built for you.

---

## What you actually do with it

A few scenarios, written the way customers describe them.

**"A competitor just raised a Series B."** You'd want to know within a day, with the
funding amount, the investors, the headcount they'll likely hire, and a fast assessment
of what it means for your positioning. RivalScan surfaces the funding event, re-scores
the competitor's threat level with reasoning written for your business context, and adds
an evidence-backed prediction of the moves they'll likely make over the next 30, 60, and
90 days.

**"Sales lost a deal to X — what's their pitch?"** Five minutes before the next prospect
call, you want a one-page brief: positioning, recent product moves, current customers,
three concrete ways you can win against them. RivalScan generates a battlecard PDF on
demand, including AI-suggested win-against tactics rated by difficulty and impact. It's
shareable as a 30-day public link, so a sales rep can open it without logging in.

**"Are we keeping up?"** Once you're tracking five or ten competitors, the question
shifts from any one of them to the *portfolio*. Our comparator matrix lays them all out
as rows — threat, momentum, stage, signal tags — so you can see at a glance who's
accelerating, who's gone quiet, and who's repositioning. Share of Voice ranks whose
narrative is dominating the news, product, funding, hiring, and social conversation —
your brand included, ranked honestly.

**"What's the market saying about us this quarter?"** Brand Pulse points the same
research engine at your *own* brand, reframed as media intelligence. You get a coverage
feed, a twelve-week sentiment trend, a 0–100 Brand Health Score with a confidence badge,
and an opt-in PR-flavoured weekly briefing that contrasts your momentum against
competitors' and suggests two or three narrative angles.

**"I want one Monday email with the three things that matter."** That's our weekly
digest. It's the passive-consumption surface — the briefing for execs and founders who
don't want to log in. It carries the top recommended actions, the top changes of the
week, and a strategic prose summary written for your context.

**"Wire it into our existing tools."** High-significance changes can fire into a Slack
channel in real time. Saved-view matches can fan out through signed webhooks. Data syncs
to a warehouse via the public `/v1` API. PDF and CSV exports cover everything in between.

---

## How it works, in 30 seconds

1. **You tell us who your competitors are.** We'll suggest five to eight likely ones from
   your company profile, and you can edit. You can also point us at your own brand if
   you want Brand Pulse.
2. **We research the open web with AI on a recurring cadence.** For each competitor we
   pull structured findings across five categories — news, product, funding, hiring,
   social — each with source citations, a sentiment tag, and a time-sensitivity tag.
3. **We detect what's actually new.** Each run compares the new findings against the
   prior baseline and surfaces only what's genuinely changed, scored for significance.
4. **We score and enrich.** Every competitor gets a momentum trend, a threat level
   personalised to your company context, signal tags (e.g. `just-raised`,
   `hiring-aggressively`), and an evidence-backed prediction of likely next moves.
5. **We deliver.** A live dashboard, a Monday email briefing, Slack alerts on
   high-significance items, optional PDF exports and webhooks, and a public API if you
   want the raw data.

The whole loop runs without you doing anything. You can also click *Research now* any
time you want a fresh pass — before a sales call, after a rumour, ahead of a board
meeting.

---

## The product, feature by feature

What's actually in the app today, organised by what you'd do with each piece.

### The competitor feed

Every competitor has a feed of *changes*. A change is something genuinely new since the
last research pass — a funding round, a product launch, a senior hire, a pricing change,
a press mention. Each one carries the source citation, a significance score, an
explanation of why it matters in your context, and a sentiment and time-sensitivity tag.
The feed is filterable by competitor, category, time window, and significance threshold.

*When you'd reach for it:* the daily five-minute check-in, the "what happened this week"
review, or replying to a sales rep who's just lost a deal and wants to know if there's
something fresh on the competitor.

### Threat level, momentum, and tags

Each competitor card carries three at-a-glance signals: a **threat level** (critical,
high, medium, low, monitor) with a one-to-two sentence rationale written in your
business context; a **momentum trend** (rising, stable, slowing, declining) with a
percent change; and up to six **derived tags** (e.g. `just-raised`,
`hiring-aggressively`, `going-upmarket`, `ai-native`).

*When you'd reach for it:* deciding which competitor to dig into when you only have ten
minutes; sorting the portfolio by who needs attention this week.

### Predicted moves

For each competitor we maintain a forward-looking forecast — what they're likely to do in
the next 30, 60, and 90 days, each prediction citing the evidence behind it and carrying
a probability estimate. Predictions are re-evaluated as new evidence comes in.

*When you'd reach for it:* roadmap planning, sales objection prep, or anticipating a
positioning shift before it lands.

### Recommendations

Every week we synthesise everything — changes, predictions, momentum — into a short,
calibrated action list framed as *what you should do this week*. Each item is tagged
with a category, an effort estimate, a time horizon, a confidence level, and a link to
the change that triggered it.

The visible count is metered by tier — Scout sees the top three, Strategist sees ten,
Command sees the full list with the option to bias the generator toward one to three
custom focus areas you name (e.g. "channel partnerships," "pricing moves").

*When you'd reach for it:* Monday-morning planning, translating intelligence into a team
to-do list, briefing leadership on what you're going to *do* about what you're seeing.

### Battlecards

Generate a per-competitor battlecard PDF on demand. It combines the latest research, the
threat assessment, and three to five **AI-generated win-against tactics**, each rated by
difficulty and impact. Each battlecard is shareable through a public 30-day link, so a
sales rep can open it without logging in.

*When you'd reach for it:* sales enablement; forwarding a brief to a rep five minutes
before a call; onboarding a new AE to your competitive landscape.

### Comparator matrix

A portfolio view of every competitor as a row, with threat, momentum, stage, and tags
as columns. Sortable, filterable, exportable.

*When you'd reach for it:* anything that involves "the portfolio" — board updates,
weekly internal reviews, deciding who to add or drop from active tracking.

### Brand Pulse

The same research engine, pointed at your own brand and reframed as media intelligence
("how is the market perceiving us?"). You get a coverage feed, a twelve-week sentiment
time series, and a **Brand Health Score** — a 0–100 composite of sentiment, share of
voice, and momentum, with a confidence badge keyed to mention volume.

*When you'd reach for it:* PR and comms reviews; quarterly brand health check-ins; tying
the brand work back to a single number a CEO understands.

### Share of Voice + Comparative Weekly Briefing

Share of Voice ranks who's dominating the conversation — overall and per category — over
a 7-, 30-, or 90-day window, with your brand ranked honestly alongside competitors. The
opt-in **Comparative Weekly Briefing** turns the same data into a PR-flavoured Monday
email, contrasting your momentum against competitors' and suggesting two or three
narrative angles.

*When you'd reach for it:* answering "are we winning the narrative?"; pitching
journalists with a fresh angle; internal brand reviews.

### Saved views, subscriptions, and search

Build a named filter set ("AI competitors' product launches," "anyone in our segment
who raised in the last 30 days") and subscribe yourself or a teammate to it. New matches
get a weekly digest of their own. There's also free-text search across all changes and
competitors.

*When you'd reach for it:* personal focus areas; routing intelligence to the right
person on the team — your PMM cares about pricing changes, your sales lead cares about
deal signals.

### Integrations and exports

- **Slack** — high-significance changes pushed to a channel in real time.
- **Webhooks** — HMAC-signed POSTs on saved-view matches, for custom routing and automation.
- **Email** — Monday digest, opt-in comparative briefing, weekly digests for each saved
  view, in-app notifications.
- **PDF / CSV exports** — board-ready weekly briefings; data dumps of changes,
  competitors, and recommendations.
- **Public API (`/v1`)** — X-API-Key read and write access, for syncing into a
  warehouse, building a custom dashboard, or wiring up automations.
- **Scheduled reports** — automated monthly executive PDF, delivered on the 1st of every
  month (Command tier).Wha

### Teams and roles

A workspace can have multiple seats with an `owner > admin > member` hierarchy. Owners
can do anything; admins can invite and manage members and edit content; members are
read-mostly. Invitations are token-based and time-bound. Every governance action —
invites, role changes, ownership transfer — is captured in an audit log.

*When you'd reach for it:* once more than one person needs to see the same data. Scout
is effectively solo; Strategist and Command include real seat counts.

---

## What you'll see in week 1, week 4, and beyond

**Day 1 (onboarding).** You'll be asked for your company name, industry, your own
website (if you want Brand Pulse), and a starting list of competitors. We'll suggest
five to eight likely ones from your profile — you can accept, edit, or replace. About
fifteen minutes in, your dashboard starts lighting up with the first research findings.

**Week 1.** The dashboard fills out. You see the first set of changes per competitor,
with sources, scores, and explanations. Your first weekly digest arrives Monday morning.

**Week 4.** Momentum trends become meaningful — they need around thirty days of change
data to be credible — and predictions sharpen as the system has multiple data points to
compare. The weekly briefing starts to *sound* like it knows your market.

**Ongoing.** Research re-runs on a cadence — weekly by default on Scout and Strategist,
fortnightly on Command (overridable per competitor). You'll click *Research now* only
when you need a fresh pass for a specific reason — a rumoured raise, an upcoming sales
call, a board meeting tomorrow.

---

## How RivalScan is different

**vs. Google Alerts and RSS** — they alert; we triage, score, explain, and recommend.
Alerts are raw. We give you the thing you'd otherwise spend an hour producing from those
alerts.

**vs. Crayon and Klue** — same job, a fraction of the price, no analyst required.
They're great when you have a CI team. RivalScan is great when you don't, and aren't
going to hire one in the next eighteen months.

**vs. doing it manually on Sundays** — your Sundays are yours again. And consistency
beats heroics: the system runs every week even when you're on holiday, sick, or in a
quarter-end scramble.

---

## What RivalScan isn't

We are deliberately *not* a few things, and saying so up front saves everyone time.

- **Not a CRM, not a sales-engagement tool, not a CDP.** We feed those systems with
  intelligence; we don't replace them.
- **Not real-time intraday monitoring.** Research runs on a cadence, not on every page
  change. If a competitor publishes at 9:03am, you'll see it on the next research pass,
  not in nine minutes. For most strategic decisions, that's the right cadence.
- **Not a substitute for human judgment.** Every AI-generated output — threat reasoning,
  predictions, recommendations, battlecard tactics — is labelled as such, carries
  citations, and asks you to confirm before acting. We're a force multiplier, not an
  oracle.
- **Not for tracking individuals.** A pre-research input classifier rejects person-name
  targets and sanctioned entities before any research starts. RivalScan is for
  competitive intelligence on *companies*, not people.

---

## Pricing in plain English

We sell three tiers, structured as a strict ladder — each tier is a superset of the one
below. Live prices and the current feature matrix live on the [pricing page](/pricing).

**Scout.** For the solo founder or one person evaluating whether competitive intel is
worth doing properly. A small competitor count, a 30-day history window, the core
intelligence engine, Brand Pulse, predicted moves, and a weekly digest. No exports, no
integrations, no team seats — just the product.

**Strategist.** For the team that's decided to operationalise competitive intel. More
competitors, a 90-day history, PDF and CSV exports, Slack and webhook integrations, the
comparator matrix, the public API with read-and-write keys, saved views, and multi-seat
collaboration. This is the tier where the product starts replacing real workflow tools.

**Command.** For the power user and larger team. The largest competitor / history /
seat / saved-view / API-key counts, custom recommendation focus areas (you name one to
three themes and the weekly recommendations bias toward them), and scheduled monthly
executive PDF reports.

Brand Pulse, predicted moves, battlecards, and onboarding suggestions are available on
every tier.

---

## Trust, safety, and compliance

A few things we take seriously and want you to know up front:

- **AI disclaimers everywhere we generate text.** Threat reasoning, predicted moves,
  recommendations, and battlecard tactics all label themselves as AI-generated and ask
  you to confirm before relying on them.
- **Every finding cites its sources.** You can click through to the original article,
  post, or filing every claim is based on.
- **Sanctions and misuse screening.** Before any research runs, an input classifier
  rejects person-name targets, sanctioned entities (against the OFAC SDN list), and
  non-business research targets. RivalScan is for competitive intelligence on
  companies, not surveillance.
- **GDPR and CCPA data rights are first-class.** Full personal-data export and
  self-service account deletion are available in settings. Our
  [privacy policy](/legal/privacy), [terms](/legal/terms),
  [acceptable use policy](/legal/aup), [data processing agreement](/legal/dpa), and
  [sub-processor list](/legal/sub-processors) are all public.
- **Operational transparency.** A public status page, driven by live infrastructure
  monitoring, shows when something's broken before you have to ask.

---

## Getting started

The fastest way to evaluate RivalScan is to sign up, complete onboarding (around five
minutes), and let the first research pass populate your dashboard. By the time you
finish your second cup of coffee, you'll have a working competitive feed with real data
on your real competitors, scored against your real company context.

[**Start a free trial →**](/sign-up)
