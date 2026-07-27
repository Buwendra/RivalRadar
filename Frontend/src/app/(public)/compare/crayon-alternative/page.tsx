import { Metadata } from "next";
import {
  CompareTemplate,
  CompareRow,
} from "@/components/marketing/compare-template";

export const metadata: Metadata = {
  title: "Crayon Alternative for Small Teams",
  description:
    "Kironyx is a Crayon alternative built for SMBs: AI competitive intelligence plus brand monitoring at $49–$199/month, self-serve, no annual contract.",
};

const ROWS: CompareRow[] = [
  {
    label: "Pricing",
    kironyx: "$49–$199/month, published on the site",
    competitor: "Quote-based enterprise pricing, commonly cited in the tens of thousands per year",
    kironyxWins: true,
  },
  {
    label: "Getting started",
    kironyx: "Guided onboarding; first research runs within minutes of setup",
    competitor: "Demo call with sales, then guided onboarding",
    kironyxWins: true,
  },
  {
    label: "Contract",
    kironyx: "Monthly, cancel anytime",
    competitor: "Typically annual contracts",
    kironyxWins: true,
  },
  {
    label: "Your own brand",
    kironyx: "Brand Pulse runs the same research on you, on every plan",
    competitor: "Focused on tracking competitors",
    kironyxWins: true,
  },
  {
    label: "Research model",
    kironyx: "AI deep web research with cited sources, weekly + on-demand",
    competitor: "Broad data collection across many field sources, curated for CI teams",
    kironyxWins: false,
  },
  {
    label: "Sales enablement",
    kironyx: "AI battlecards with win-against tactics, shareable as PDFs",
    competitor: "Mature battlecard workflows with CRM integrations for large sales teams",
    kironyxWins: false,
  },
  {
    label: "Built for",
    kironyx: "Founders and small marketing/product teams",
    competitor: "Dedicated CI and product-marketing functions at larger companies",
    kironyxWins: true,
  },
];

const WHERE_WE_WIN = [
  {
    title: "The price of one enterprise seat runs your whole year",
    description:
      "Enterprise CI platforms are priced for companies with a dedicated analyst. Kironyx delivers scored, cited competitive intelligence at a price a bootstrapped team can expense without a procurement cycle.",
  },
  {
    title: "It watches you, not just them",
    description:
      "Competitor tracking without your own position is half a picture. Brand Pulse runs the identical research on your brand — share of voice, sentiment, brand health — so every insight lands with context.",
  },
  {
    title: "Zero analyst required",
    description:
      "The AI does the reading: every change is significance-scored 1–10 with impact analysis, and only the moves that matter reach your Monday brief. No feeds to triage, no dashboards to babysit.",
  },
];

const WHEN_THEY_WIN = {
  intro:
    "Crayon is a genuinely capable enterprise platform, and there are situations where it's the right call:",
  items: [
    "You have a dedicated competitive-intelligence or PMM function with time to curate feeds",
    "You need deep CRM-integrated battlecard workflows for a large sales organization",
    "You're tracking dozens of competitors across many markets with enterprise compliance requirements",
    "Budget for a five-figure annual CI contract is already approved",
  ],
};

const FAQS = [
  {
    question: "Is Kironyx a full replacement for Crayon?",
    answer:
      "For an SMB, usually yes — you get AI-researched competitor tracking, significance-scored changes, weekly strategic briefs, battlecards, and brand monitoring. For a large enterprise running a staffed CI program with CRM-integrated enablement workflows, Crayon covers workflows Kironyx doesn't try to. We're honest about that above.",
  },
  {
    question: "How is the research different?",
    answer:
      "Kironyx runs Claude-powered deep web research on each tracked company — searching news, product, funding, hiring, and social signals — then compares runs to detect genuine changes and scores each one 1–10 for strategic significance. Every finding cites the web sources it came from.",
  },
  {
    question: "Can I migrate from Crayon?",
    answer:
      "There's nothing to migrate: add your competitors' websites during onboarding — and your own brand alongside them — and Kironyx starts researching immediately. Your first cited findings typically land within minutes.",
  },
  {
    question: "What does it cost?",
    answer:
      "Public pricing: Scout at $49/month (3 competitors), Strategist at $99/month (10 competitors, Slack + API), Command at $199/month (25 competitors, executive PDF briefings). All plans are monthly and include Brand Pulse self-monitoring on your own brand.",
  },
];

export default function CrayonAlternativePage() {
  return (
    <CompareTemplate
      competitorName="Crayon"
      eyebrow="Crayon alternative"
      title={
        <>
          Competitive intelligence,{" "}
          <span className="text-gradient-primary">without the enterprise contract</span>
        </>
      }
      intro="Crayon is built — and priced — for enterprise CI teams. Kironyx delivers AI-researched competitor tracking plus brand monitoring for SMBs at $49–$199/month, self-serve, cancel anytime."
      rows={ROWS}
      whereWeWin={WHERE_WE_WIN}
      whenTheyWin={WHEN_THEY_WIN}
      faqs={FAQS}
    />
  );
}
