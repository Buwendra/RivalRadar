/**
 * Populate the self-brand row for buwendra.s@gmail.com with realistic
 * Change records + ResearchFinding history so the Your Brand page (Brand
 * Pulse + Brand Health Score + Share of Voice + sentiment timeseries) has
 * dense, demo-ready data.
 *
 * Pure DDB writes — no Anthropic spend. Idempotent on re-run: each invocation
 * appends a new batch keyed by ULID timestamps. Safe to run multiple times.
 *
 * Usage (from Backend/):
 *   TABLE_NAME=Kironyx-dev-Database-Table \
 *   npx ts-node scripts/seed-brand-data.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { generateId } from '../src/shared/utils/id';

const TABLE = process.env.TABLE_NAME;
const USER_ID = '01KPWTQZHS6J9FZF7XM268MTEQ';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

if (!TABLE) {
  console.error('TABLE_NAME env var required');
  process.exit(1);
}

const raw = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

async function findSelfBrand(): Promise<{ id: string; name: string } | null> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :p AND begins_with(SK, :s)',
      ExpressionAttributeValues: { ':p': `USER#${USER_ID}`, ':s': 'COMP#' },
    })
  );
  for (const item of out.Items ?? []) {
    if (item.targetKind === 'self') {
      return { id: item.id as string, name: item.name as string };
    }
  }
  return null;
}

type Sentiment = 'positive' | 'neutral' | 'negative';
type TimeSensitivity = 'breaking' | 'recent' | 'historical';
type Category = 'news' | 'product' | 'funding' | 'hiring' | 'social';

interface ChangeSeed {
  title: string;
  detail: string;
  recommendedAction: string;
  strategicImplication: string;
  significance: number;
  category: Category;
  sentiment: Sentiment;
  pageUrl: string;
  citationTitle: string;
  citationUrl: string;
  daysAgo: number;
}

// 22 Change records spread over the last ~21 days — TechCrunch / Information /
// VentureBeat coverage, ProductHunt + YC features, hiring posts, funding
// rumours, integration launches, customer quotes. Mix of sentiment so the
// charts don't look propagandistic.
const CHANGE_SEEDS: ChangeSeed[] = [
  {
    title: 'TechCrunch profiles Kironyx as AI-native CI for SMBs',
    detail: 'TechCrunch published a feature on Kironyx covering the Brand Pulse launch and the gap between $20-a-month Google Alerts and $20k/year Crayon/Klue.',
    recommendedAction: 'Lean into the coverage with a customer-quotes follow-up and pitch the same angle to The Information.',
    strategicImplication: 'Validates the SMB CI positioning publicly and provides a citation for outbound and investor decks.',
    significance: 8,
    category: 'news',
    sentiment: 'positive',
    pageUrl: 'https://techcrunch.com/2026/05/kironyx-ai-competitive-intel-smb/',
    citationTitle: "TechCrunch: 'Kironyx wants to be the Crayon for the rest of us'",
    citationUrl: 'https://techcrunch.com/2026/05/kironyx-ai-competitive-intel-smb/',
    daysAgo: 2,
  },
  {
    title: 'The Information cites Kironyx in AI-native sales tooling roundup',
    detail: 'A paywalled feature on the rise of AI-native sales tooling lists Kironyx among five startups reshaping the competitive-intelligence category.',
    recommendedAction: 'Cross-post the relevant excerpt on LinkedIn and tag the journalist for relationship.',
    strategicImplication: 'Premium-tier press placement; subscribers skew toward enterprise decision makers.',
    significance: 7,
    category: 'news',
    sentiment: 'positive',
    pageUrl: 'https://www.theinformation.com/articles/the-ai-native-sales-stack-2026',
    citationTitle: 'The Information: The AI-native sales stack of 2026',
    citationUrl: 'https://www.theinformation.com/articles/the-ai-native-sales-stack-2026',
    daysAgo: 5,
  },
  {
    title: 'VentureBeat covers Brand Pulse launch',
    detail: 'VentureBeat ran a piece on Kironyx extending its monitoring engine to self-brand tracking with the Phase 23 Brand Pulse release.',
    recommendedAction: 'Add the article to the homepage press strip and use it as social proof in sales sequences.',
    strategicImplication: 'Validates Brand Pulse as a category-redefining move rather than a feature add-on.',
    significance: 6,
    category: 'product',
    sentiment: 'positive',
    pageUrl: 'https://venturebeat.com/ai/kironyx-brand-pulse-launch/',
    citationTitle: 'VentureBeat: Kironyx launches Brand Pulse for self-monitoring',
    citationUrl: 'https://venturebeat.com/ai/kironyx-brand-pulse-launch/',
    daysAgo: 8,
  },
  {
    title: 'Hacker News front page — Show HN: Kironyx',
    detail: 'A Show HN post about Brand Pulse reached the HN front page (rank #6) with 240+ points and 80+ comments — mostly positive, a few asking about Slack vs Teams.',
    recommendedAction: 'Reply to top-rated comments addressing the Slack-vs-Teams question (now in Phase 11 Go Live).',
    strategicImplication: 'Inbound spike: ~1.2k signups likely from this single touchpoint.',
    significance: 9,
    category: 'social',
    sentiment: 'positive',
    pageUrl: 'https://news.ycombinator.com/item?id=42068911',
    citationTitle: 'Show HN: Kironyx — competitive intel for SMBs',
    citationUrl: 'https://news.ycombinator.com/item?id=42068911',
    daysAgo: 11,
  },
  {
    title: 'Product Hunt #2 product of the day',
    detail: 'Kironyx finished #2 on Product Hunt for the day of launch with 680+ upvotes and a "Product Hunt Featured" badge.',
    recommendedAction: 'Send a thank-you to the makers community and surface the badge on the homepage above-the-fold.',
    strategicImplication: 'Sustained referral traffic for the next 6-8 weeks from the Product Hunt newsletter.',
    significance: 7,
    category: 'social',
    sentiment: 'positive',
    pageUrl: 'https://www.producthunt.com/posts/kironyx',
    citationTitle: 'Product Hunt: Kironyx',
    citationUrl: 'https://www.producthunt.com/posts/kironyx',
    daysAgo: 12,
  },
  {
    title: 'Y Combinator newsletter highlights Kironyx',
    detail: 'YC\'s monthly portfolio update featured Kironyx in the "alums to watch" section, noting the Brand Pulse launch and the AI-driven research engine.',
    recommendedAction: 'Forward the segment to investors who care about YC signal and surface it in the next investor update.',
    strategicImplication: 'Re-engages YC partners and demo-day attendees for warm intros.',
    significance: 8,
    category: 'news',
    sentiment: 'positive',
    pageUrl: 'https://www.ycombinator.com/posts/portfolio-may-2026',
    citationTitle: 'YC portfolio update — May 2026',
    citationUrl: 'https://www.ycombinator.com/posts/portfolio-may-2026',
    daysAgo: 14,
  },
  {
    title: 'New hire: Head of Engineering joins from Linear',
    detail: 'LinkedIn announcement that Kironyx hired its first Head of Engineering, previously a staff engineer at Linear. Post has 1.4k reactions.',
    recommendedAction: 'Use the announcement in candidate outreach for senior eng hires this quarter.',
    strategicImplication: 'Signals engineering maturity and unlocks higher-velocity hiring at the senior end of the pipeline.',
    significance: 7,
    category: 'hiring',
    sentiment: 'positive',
    pageUrl: 'https://www.linkedin.com/posts/buwendra-abeysuriya_were-hiring-eng-head',
    citationTitle: 'LinkedIn: Kironyx welcomes Head of Engineering',
    citationUrl: 'https://www.linkedin.com/posts/buwendra-abeysuriya_were-hiring-eng-head',
    daysAgo: 15,
  },
  {
    title: 'New hire: Founding designer joins from Notion',
    detail: 'A founding designer hire from Notion announced their move on LinkedIn — visual identity refresh expected in Q3.',
    recommendedAction: 'Brief the new hire on the Brand Pulse visual language so the upcoming refresh stays consistent.',
    strategicImplication: 'Product polish + brand consistency become a competitive differentiator vs enterprise CI tools.',
    significance: 6,
    category: 'hiring',
    sentiment: 'positive',
    pageUrl: 'https://www.linkedin.com/posts/founding-designer-kironyx',
    citationTitle: 'LinkedIn: Joining Kironyx as founding designer',
    citationUrl: 'https://www.linkedin.com/posts/founding-designer-kironyx',
    daysAgo: 17,
  },
  {
    title: 'Series A rumour: term sheet from Tier-1 fund',
    detail: 'A widely-shared tweet from a SaaS analyst claims Kironyx has a term sheet from a Tier-1 fund for a ~$12M Series A. Unconfirmed.',
    recommendedAction: 'Stay quiet publicly; brief existing investors privately to avoid leaks. Brand Pulse picked this up — treat it as a heat-check.',
    strategicImplication: 'Even if speculative, the rumour signals market belief in the trajectory. Inbound from competing funds expected.',
    significance: 8,
    category: 'funding',
    sentiment: 'neutral',
    pageUrl: 'https://twitter.com/saasanalyst/status/9412381',
    citationTitle: 'SaaS Analyst tweet: rumour mill',
    citationUrl: 'https://twitter.com/saasanalyst/status/9412381',
    daysAgo: 6,
  },
  {
    title: 'Sequoia partner publicly endorses Kironyx',
    detail: 'A Sequoia partner posted "the founders to watch in CI" on Twitter and named Kironyx first. 1.8k reposts.',
    recommendedAction: 'Quote-retweet with a thank-you and link to the demo signup. Use in investor outreach.',
    strategicImplication: 'Top-tier VC endorsement narrows the valuation gap with Crayon-tier competitors.',
    significance: 7,
    category: 'funding',
    sentiment: 'positive',
    pageUrl: 'https://twitter.com/sequoia-partner/status/9438201',
    citationTitle: 'Sequoia partner tweet',
    citationUrl: 'https://twitter.com/sequoia-partner/status/9438201',
    daysAgo: 10,
  },
  {
    title: 'Bessemer reaches out for diligence call',
    detail: 'Inbound from a Bessemer principal asking for a 30-min diligence call — likely off the back of the Sequoia partner tweet.',
    recommendedAction: 'Take the call; use as price-discovery without committing to a process.',
    strategicImplication: 'Competitive interest signal — useful in the term-sheet negotiation if the Tier-1 process advances.',
    significance: 6,
    category: 'funding',
    sentiment: 'positive',
    pageUrl: 'https://www.bessemer.com/portfolio',
    citationTitle: 'Bessemer Venture Partners (referenced via inbound)',
    citationUrl: 'https://www.bessemer.com/portfolio',
    daysAgo: 13,
  },
  {
    title: 'Brand Pulse + comparative analytics shipped',
    detail: 'Self-announcement post covering the Phase 23/24 launch — Brand Pulse, Share of Voice, Brand Health Score.',
    recommendedAction: 'Watch for follow-up coverage and reach out to early adopters with white-glove onboarding.',
    strategicImplication: 'Closes the loop from "monitor competitors" to "monitor yourself relative to competitors" — the category-defining move.',
    significance: 8,
    category: 'product',
    sentiment: 'positive',
    pageUrl: 'https://kironyx.com/blog/brand-pulse-launch',
    citationTitle: 'Kironyx blog: Introducing Brand Pulse',
    citationUrl: 'https://kironyx.com/blog/brand-pulse-launch',
    daysAgo: 9,
  },
  {
    title: 'Battlecard PDF feature added',
    detail: 'New per-competitor Battlecard PDF generator with a public share-token URL. Strategist+ tier-gated.',
    recommendedAction: 'Add a "shareable battlecard" testimonial slot in the case-study template.',
    strategicImplication: 'Sales-enablement use case turns the product into a viral artifact (the share link surfaces the product to non-customers).',
    significance: 6,
    category: 'product',
    sentiment: 'positive',
    pageUrl: 'https://kironyx.com/blog/battlecard-pdf',
    citationTitle: 'Kironyx blog: Battlecard PDF launch',
    citationUrl: 'https://kironyx.com/blog/battlecard-pdf',
    daysAgo: 18,
  },
  {
    title: 'Predicted Moves feature ships',
    detail: '30/60/90-day predictions per competitor, generated from prior research findings.',
    recommendedAction: 'Highlight the forward-looking aspect in the demo script; differentiates from rear-view tools.',
    strategicImplication: 'Predictive intelligence is the most defensible AI-native moat vs Google Alerts and legacy CI.',
    significance: 7,
    category: 'product',
    sentiment: 'positive',
    pageUrl: 'https://kironyx.com/blog/predicted-moves',
    citationTitle: 'Kironyx blog: Predicted Moves',
    citationUrl: 'https://kironyx.com/blog/predicted-moves',
    daysAgo: 21,
  },
  {
    title: 'Customer case study: ACME Co',
    detail: 'First named case study — ACME Co (mid-market e-commerce) credits Kironyx with surfacing a key pricing move 9 days ahead of internal sales intelligence.',
    recommendedAction: 'Productize the story: video testimonial + one-pager + paid LinkedIn amplification.',
    strategicImplication: 'Concrete time-to-insight win — the most credible objection-handler in the sales motion.',
    significance: 7,
    category: 'news',
    sentiment: 'positive',
    pageUrl: 'https://kironyx.com/customers/acme',
    citationTitle: 'Kironyx customer story: ACME Co',
    citationUrl: 'https://kironyx.com/customers/acme',
    daysAgo: 16,
  },
  {
    title: 'Reddit r/SaaS thread asking about Kironyx',
    detail: 'A founder posted asking "anyone tried Kironyx vs Klue?" — generated 40+ comments mostly comparing pricing and SMB fit.',
    recommendedAction: 'Founder reply in-thread with honest positioning vs Klue; do not stealth-market.',
    strategicImplication: 'Authentic SMB community signal — useful for product-led-growth narratives.',
    significance: 6,
    category: 'social',
    sentiment: 'neutral',
    pageUrl: 'https://www.reddit.com/r/SaaS/comments/kironyx-vs-klue',
    citationTitle: 'r/SaaS: Kironyx vs Klue?',
    citationUrl: 'https://www.reddit.com/r/SaaS/comments/kironyx-vs-klue',
    daysAgo: 4,
  },
  {
    title: 'SaaStr podcast mention',
    detail: 'A SaaStr podcast guest mentioned Kironyx as their go-to tool for tracking 3-5 specific competitors without enterprise spend.',
    recommendedAction: 'Cut the segment to a 60-second clip, post on LinkedIn + Twitter with the timestamp link.',
    strategicImplication: 'Top-of-funnel awareness in the SaaS-founder audience that converts well to Scout-tier signups.',
    significance: 6,
    category: 'social',
    sentiment: 'positive',
    pageUrl: 'https://www.saastr.com/podcasts/episode-741',
    citationTitle: 'SaaStr podcast — episode 741',
    citationUrl: 'https://www.saastr.com/podcasts/episode-741',
    daysAgo: 7,
  },
  {
    title: 'Comparative review: Kironyx vs Crayon vs Klue',
    detail: 'A SaaS reviewer published a 4-tool comparison putting Kironyx on top for SMB use cases but flagging the lack of API access on lower tiers.',
    recommendedAction: 'Address the API tier-gating critique in the next pricing iteration; counter-quote the SMB win in sales.',
    strategicImplication: 'Tier 1 critique is fair and confirms the upgrade-path narrative; the SMB win cements positioning.',
    significance: 7,
    category: 'news',
    sentiment: 'neutral',
    pageUrl: 'https://www.saasreviewer.com/articles/ci-tools-2026',
    citationTitle: 'SaaSReviewer: CI tools compared (2026)',
    citationUrl: 'https://www.saasreviewer.com/articles/ci-tools-2026',
    daysAgo: 3,
  },
  {
    title: 'Customer complaint thread on Twitter — onboarding friction',
    detail: 'A new user posted a critical thread about hitting too many "research now" rate limits in the first hour. 30 replies; mostly sympathetic.',
    recommendedAction: 'Reach out privately, refund the month, and use the feedback in the next onboarding QA pass.',
    strategicImplication: 'Real friction point — rate limits intended for misuse defense are bleeding into legitimate exploration.',
    significance: 8,
    category: 'social',
    sentiment: 'negative',
    pageUrl: 'https://twitter.com/some-user/status/9501122',
    citationTitle: 'User complaint thread',
    citationUrl: 'https://twitter.com/some-user/status/9501122',
    daysAgo: 1,
  },
  {
    title: 'Integration: Slack alerts now in beta',
    detail: 'Slack OAuth + per-channel critical-alert routing now in beta on Strategist+.',
    recommendedAction: 'Open-beta the feature to existing Strategist customers via email; measure activation rate.',
    strategicImplication: 'Slack is the SMB office; this is the highest-retention multi-channel feature.',
    significance: 6,
    category: 'product',
    sentiment: 'positive',
    pageUrl: 'https://kironyx.com/blog/slack-beta',
    citationTitle: 'Kironyx blog: Slack alerts now in beta',
    citationUrl: 'https://kironyx.com/blog/slack-beta',
    daysAgo: 19,
  },
  {
    title: 'New hire: Founding GTM hire from Gong',
    detail: 'Announcement that a former Gong AE joined as the first GTM hire to build the sales-led motion.',
    recommendedAction: 'Pair the new hire with the founder for the next 30 days on demo calls before letting them solo-run.',
    strategicImplication: 'Marks the transition from founder-led sales to a repeatable motion — likely accelerates ACV growth.',
    significance: 6,
    category: 'hiring',
    sentiment: 'positive',
    pageUrl: 'https://www.linkedin.com/posts/gtm-hire-kironyx',
    citationTitle: 'LinkedIn: New GTM hire announcement',
    citationUrl: 'https://www.linkedin.com/posts/gtm-hire-kironyx',
    daysAgo: 20,
  },
  {
    title: 'Influencer endorsement on Twitter',
    detail: 'A high-follower SaaS-Twitter operator (~250k followers) posted "the only CI tool I\'d run as a solo founder" — 600+ likes.',
    recommendedAction: 'Direct-message thanks and offer a 6-month Command-tier comp in exchange for an authentic review video.',
    strategicImplication: 'Cuts through the noise for the target persona (solo founders / small founding teams).',
    significance: 7,
    category: 'social',
    sentiment: 'positive',
    pageUrl: 'https://twitter.com/saas-operator/status/9500233',
    citationTitle: 'SaaS operator endorsement tweet',
    citationUrl: 'https://twitter.com/saas-operator/status/9500233',
    daysAgo: 0,
  },
];

interface FindingItemSeed {
  title: string;
  detail: string;
  sourceUrl: string;
  importance: 1 | 2 | 3;
  sentiment: Sentiment;
  timeSensitivity: TimeSensitivity;
}

interface FindingSeed {
  daysAgo: number;
  summary: string;
  derivedState: {
    stage: string;
    fundingState: string;
    hiringState: string;
    strategicDirection: string;
    techPositioning: string;
    pacing: string;
    evidenceNotes: string;
  };
  categories: Record<Category, FindingItemSeed[]>;
}

// Three research findings spread across the last 28 days — older finding is
// more sparse, more recent ones reflect the launch wave. Drives the sentiment
// timeseries on /brand/sentiment + powers the Brand Health Score sentiment
// component.
const FINDING_SEEDS: FindingSeed[] = [
  {
    daysAgo: 28,
    summary:
      'Early-stage seed-funded CI startup with growing developer interest. Limited press coverage; mostly Show HN buzz and a small community on Twitter.',
    derivedState: {
      stage: 'early',
      fundingState: 'bootstrapped',
      hiringState: 'steady',
      strategicDirection: 'specializing',
      techPositioning: 'ai-native',
      pacing: 'shipping-fast',
      evidenceNotes:
        'Self-funded; one technical co-founder shipping daily; SaaS-Twitter awareness building from the YC alum signal.',
    },
    categories: {
      news: [
        {
          title: 'Show HN: Kironyx',
          detail: 'A Show HN post introduced Kironyx to the wider technical community.',
          sourceUrl: 'https://news.ycombinator.com/item?id=42068911',
          importance: 2,
          sentiment: 'positive',
          timeSensitivity: 'historical',
        },
        {
          title: 'YC alum directory mention',
          detail: 'Kironyx appeared in the YC alum directory under "AI tooling".',
          sourceUrl: 'https://www.ycombinator.com/companies',
          importance: 1,
          sentiment: 'neutral',
          timeSensitivity: 'historical',
        },
      ],
      product: [
        {
          title: 'Initial product launch',
          detail: 'Core competitor monitoring with weekly digest emails goes live.',
          sourceUrl: 'https://kironyx.com/blog/launch',
          importance: 3,
          sentiment: 'positive',
          timeSensitivity: 'historical',
        },
      ],
      funding: [],
      hiring: [],
      social: [
        {
          title: 'Twitter buzz from indie hackers',
          detail: 'Small but engaged community starts sharing the product.',
          sourceUrl: 'https://twitter.com/indiehackers',
          importance: 1,
          sentiment: 'positive',
          timeSensitivity: 'historical',
        },
      ],
    },
  },
  {
    daysAgo: 14,
    summary:
      'Mid-stage launch wave: Product Hunt + Hacker News + TechCrunch coverage drove a ~10x signup spike. Early enterprise inbound emerging.',
    derivedState: {
      stage: 'early',
      fundingState: 'recently-raised',
      hiringState: 'aggressive',
      strategicDirection: 'expanding-vertical',
      techPositioning: 'ai-native',
      pacing: 'shipping-fast',
      evidenceNotes:
        'Coverage spike from Product Hunt + HN + TechCrunch; new senior eng hire from Linear; investor inbound activity.',
    },
    categories: {
      news: [
        {
          title: 'TechCrunch profile',
          detail: 'TechCrunch profiles Kironyx as AI-native CI for SMBs.',
          sourceUrl: 'https://techcrunch.com/2026/05/kironyx-ai-competitive-intel-smb/',
          importance: 3,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
        {
          title: 'VentureBeat coverage of Brand Pulse',
          detail: 'VentureBeat ran a piece on the Phase 23 launch.',
          sourceUrl: 'https://venturebeat.com/ai/kironyx-brand-pulse-launch/',
          importance: 2,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
        {
          title: 'YC newsletter highlight',
          detail: 'YC portfolio update featured Kironyx in "alums to watch".',
          sourceUrl: 'https://www.ycombinator.com/posts/portfolio-may-2026',
          importance: 2,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
      ],
      product: [
        {
          title: 'Brand Pulse launch',
          detail: 'Phase 23 self-brand monitoring goes live across all tiers.',
          sourceUrl: 'https://kironyx.com/blog/brand-pulse-launch',
          importance: 3,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
        {
          title: 'Battlecard PDF feature',
          detail: 'Per-competitor PDFs with public share tokens shipped.',
          sourceUrl: 'https://kironyx.com/blog/battlecard-pdf',
          importance: 2,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
      ],
      funding: [
        {
          title: 'Sequoia partner endorsement',
          detail: 'A Sequoia partner publicly called Kironyx a "founder to watch".',
          sourceUrl: 'https://twitter.com/sequoia-partner/status/9438201',
          importance: 2,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
      ],
      hiring: [
        {
          title: 'Head of Engineering hired from Linear',
          detail: 'First senior eng hire announced on LinkedIn (1.4k reactions).',
          sourceUrl: 'https://www.linkedin.com/posts/buwendra-abeysuriya_were-hiring-eng-head',
          importance: 2,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
        {
          title: 'Founding designer from Notion',
          detail: 'A senior designer hire announced their move from Notion.',
          sourceUrl: 'https://www.linkedin.com/posts/founding-designer-kironyx',
          importance: 1,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
      ],
      social: [
        {
          title: 'HN front page #6',
          detail: 'Show HN reached HN front page rank #6 with 240+ points.',
          sourceUrl: 'https://news.ycombinator.com/item?id=42068911',
          importance: 3,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
        {
          title: 'Product Hunt #2 of the day',
          detail: 'Finished #2 with 680+ upvotes and a featured badge.',
          sourceUrl: 'https://www.producthunt.com/posts/kironyx',
          importance: 2,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
      ],
    },
  },
  {
    daysAgo: 1,
    summary:
      'Sustained coverage wave, Series-A rumour gathering momentum, growing SMB inbound. Onboarding-friction feedback is the only persistent negative signal.',
    derivedState: {
      stage: 'early',
      fundingState: 'actively-raising',
      hiringState: 'aggressive',
      strategicDirection: 'going-upmarket',
      techPositioning: 'ai-native',
      pacing: 'shipping-fast',
      evidenceNotes:
        'Series-A rumour from SaaS analyst; Bessemer diligence inbound; GTM hire from Gong; mostly positive sentiment with isolated onboarding-friction complaint.',
    },
    categories: {
      news: [
        {
          title: 'The Information AI-native sales stack feature',
          detail: 'Premium-tier press placement listing Kironyx in 5 startups reshaping CI.',
          sourceUrl: 'https://www.theinformation.com/articles/the-ai-native-sales-stack-2026',
          importance: 3,
          sentiment: 'positive',
          timeSensitivity: 'breaking',
        },
        {
          title: 'Comparative review vs Crayon/Klue',
          detail: 'Kironyx called best-for-SMB; API tier-gating critique flagged.',
          sourceUrl: 'https://www.saasreviewer.com/articles/ci-tools-2026',
          importance: 2,
          sentiment: 'neutral',
          timeSensitivity: 'breaking',
        },
        {
          title: 'ACME Co customer story',
          detail: 'Mid-market e-commerce credits Kironyx with a 9-day lead on a competitor pricing move.',
          sourceUrl: 'https://kironyx.com/customers/acme',
          importance: 2,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
      ],
      product: [
        {
          title: 'Brand Pulse + comparative analytics shipped',
          detail: 'Phase 23 + Phase 24 closed the self-monitoring loop.',
          sourceUrl: 'https://kironyx.com/blog/brand-pulse-launch',
          importance: 3,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
      ],
      funding: [
        {
          title: 'Series A term-sheet rumour',
          detail: 'SaaS analyst claims Tier-1 fund issued a ~$12M Series A term sheet (unconfirmed).',
          sourceUrl: 'https://twitter.com/saasanalyst/status/9412381',
          importance: 3,
          sentiment: 'neutral',
          timeSensitivity: 'breaking',
        },
        {
          title: 'Bessemer diligence inbound',
          detail: 'Inbound from Bessemer principal for a 30-min diligence call.',
          sourceUrl: 'https://www.bessemer.com/portfolio',
          importance: 2,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
      ],
      hiring: [
        {
          title: 'GTM hire from Gong',
          detail: 'First GTM hire to build the repeatable sales motion.',
          sourceUrl: 'https://www.linkedin.com/posts/gtm-hire-kironyx',
          importance: 2,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
      ],
      social: [
        {
          title: 'High-follower operator endorsement',
          detail: 'SaaS operator (~250k followers) called Kironyx "the only CI tool I\'d run as a solo founder".',
          sourceUrl: 'https://twitter.com/saas-operator/status/9500233',
          importance: 3,
          sentiment: 'positive',
          timeSensitivity: 'breaking',
        },
        {
          title: 'Onboarding-friction complaint thread',
          detail: 'New user complained about hitting rate limits in the first hour.',
          sourceUrl: 'https://twitter.com/some-user/status/9501122',
          importance: 2,
          sentiment: 'negative',
          timeSensitivity: 'breaking',
        },
        {
          title: 'SaaStr podcast mention',
          detail: 'A guest cited Kironyx as their go-to CI tool for SMB.',
          sourceUrl: 'https://www.saastr.com/podcasts/episode-741',
          importance: 1,
          sentiment: 'positive',
          timeSensitivity: 'recent',
        },
      ],
    },
  },
];

function isoAt(daysAgo: number, hourOffset = 0): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 + hourOffset * 60 * 60 * 1000);
  return d.toISOString();
}

async function seedChanges(selfId: string, selfName: string): Promise<number> {
  let count = 0;
  // Distribute over hour-offsets so SK ordering isn't degenerate.
  for (let i = 0; i < CHANGE_SEEDS.length; i++) {
    const seed = CHANGE_SEEDS[i];
    const changeId = generateId();
    const detectedAt = isoAt(seed.daysAgo, -(i % 8));
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `COMP#${selfId}`,
          SK: `CHANGE#${detectedAt}`,
          id: changeId,
          userId: USER_ID,
          competitorId: selfId,
          competitorName: selfName,
          pageUrl: seed.pageUrl,
          detectedAt,
          diffSummary: seed.detail,
          sourceCategory: seed.category,
          significance: seed.significance,
          aiAnalysis: {
            summary: seed.title,
            recommendedAction: seed.recommendedAction,
            strategicImplication: seed.strategicImplication,
            significanceScore: seed.significance,
            changeType: seed.category === 'product' ? 'feature' : seed.category === 'funding' ? 'messaging' : 'content',
          },
          citations: [
            {
              title: seed.citationTitle,
              url: seed.citationUrl,
              accessedAt: detectedAt,
            },
          ],
          GSI1PK: USER_ID,
          GSI1SK: `CHANGE#${detectedAt}`,
        },
      })
    );
    count++;
  }
  return count;
}

async function seedFindings(selfId: string): Promise<number> {
  let count = 0;
  for (const seed of FINDING_SEEDS) {
    const findingId = generateId();
    const generatedAt = isoAt(seed.daysAgo, 12);
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `COMP#${selfId}`,
          SK: `RESEARCH#${generatedAt}`,
          id: findingId,
          userId: USER_ID,
          competitorId: selfId,
          generatedAt,
          summary: seed.summary,
          derivedState: seed.derivedState,
          categories: seed.categories,
          GSI1PK: USER_ID,
          GSI1SK: `RESEARCH#${generatedAt}`,
        },
      })
    );
    count++;
  }
  return count;
}

async function enrichCompetitorRow(selfId: string): Promise<void> {
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `USER#${USER_ID}`, SK: `COMP#${selfId}` },
      UpdateExpression:
        'SET momentum = :m, momentumChangePercent = :mp, momentumAsOf = :now, derivedTags = :tags, derivedTagsAsOf = :now, updatedAt = :now',
      ExpressionAttributeValues: {
        ':m': 'rising',
        ':mp': 42,
        ':now': now,
        ':tags': [
          'coverage-rising',
          'narrative-funding-buzz',
          'press-spike',
          'hiring-aggressively',
          'positive-press',
        ],
      },
    })
  );
}

async function main() {
  const self = await findSelfBrand();
  if (!self) {
    console.error('Self-brand row not found. Run seed-demo-data.ts first.');
    process.exit(1);
  }
  console.log(`Found self-brand: ${self.name} (${self.id})`);

  const findings = await seedFindings(self.id);
  console.log(`+ ${findings} ResearchFinding rows`);

  const changes = await seedChanges(self.id, self.name);
  console.log(`+ ${changes} Change records`);

  await enrichCompetitorRow(self.id);
  console.log('+ enriched self-brand row (momentum=rising +42%, 5 derivedTags)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
