import { Metadata } from "next";
import {
  CompareTemplate,
  CompareRow,
} from "@/components/marketing/compare-template";

export const metadata: Metadata = {
  title: "Klue Alternative for Small Teams",
  description:
    "Kironyx is a Klue alternative for SMBs: AI competitive intelligence plus brand monitoring at $49–$199/month, self-serve, no demo call required.",
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
    kironyx: "Self-serve free trial; first research runs minutes after onboarding",
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
    competitor: "Focused on competitor tracking and sales enablement",
    kironyxWins: true,
  },
  {
    label: "Battlecards",
    kironyx: "AI-generated with win-against tactics, shareable as PDFs",
    competitor: "Industry-leading battlecard platform with CRM distribution and adoption analytics",
    kironyxWins: false,
  },
  {
    label: "Win/loss analysis",
    kironyx: "Not a focus — Kironyx is research and monitoring first",
    competitor: "Dedicated win/loss interview and analysis programs",
    kironyxWins: false,
  },
  {
    label: "Built for",
    kironyx: "Founders and small marketing/product teams",
    competitor: "Enterprise sales enablement and CI teams",
    kironyxWins: true,
  },
];

const WHERE_WE_WIN = [
  {
    title: "Intelligence without the enablement overhead",
    description:
      "Klue shines when a large sales team needs curated battlecards pushed into their CRM. If what you actually need is to know what competitors did and what it means, Kironyx delivers exactly that — automatically, every week.",
  },
  {
    title: "The mirror is included",
    description:
      "Kironyx is the only tool in this price class that runs the identical AI research on your own brand and benchmarks you against your set — share of voice, sentiment, and a composite Brand Health score on every plan.",
  },
  {
    title: "Priced for teams without a CI budget line",
    description:
      "No procurement, no annual commitment, no seat minimums. Start at $49/month, see your first cited findings in minutes, and cancel from the billing page if it's not for you.",
  },
];

const WHEN_THEY_WIN = {
  intro:
    "Klue is the category leader in competitive enablement, and it's the right choice when:",
  items: [
    "Your primary goal is arming a large sales team with curated, CRM-distributed battlecards",
    "You run structured win/loss programs and want them integrated with your CI",
    "You have a dedicated CI or PMM team to curate and publish intelligence",
    "Enterprise requirements — SSO, procurement, security review — drive the purchase",
  ],
};

const FAQS = [
  {
    question: "Is Kironyx a full replacement for Klue?",
    answer:
      "It depends what you use Klue for. For monitoring competitors, detecting strategic changes, and getting a scored weekly brief, yes — at a fraction of the price. For enterprise sales-enablement workflows (CRM-distributed battlecards, win/loss programs, adoption analytics), Klue is deeper, and we say so plainly above.",
  },
  {
    question: "Does Kironyx do battlecards?",
    answer:
      "Yes — AI-generated battlecards per competitor with win-against tactics, exportable and shareable as PDFs. What Kironyx doesn't do is Klue-style enterprise distribution: pushing cards into Salesforce and measuring rep adoption.",
  },
  {
    question: "How fast do I see value?",
    answer:
      "Onboarding takes about two minutes. Deep research kicks off immediately for every competitor you add — and for your own brand — with first cited findings typically within minutes and your first Monday brief the following week.",
  },
  {
    question: "What does it cost?",
    answer:
      "Public pricing: Scout at $49/month (3 competitors), Strategist at $99/month (10 competitors, Slack + API), Command at $199/month (25 competitors, executive PDF briefings). All plans are monthly with a free trial and include Brand Pulse self-monitoring.",
  },
];

export default function KlueAlternativePage() {
  return (
    <CompareTemplate
      competitorName="Klue"
      eyebrow="Klue alternative"
      title={
        <>
          Competitive intelligence,{" "}
          <span className="text-gradient-primary">minus the sales-enablement tax</span>
        </>
      }
      intro="Klue is built for enterprise sales enablement, priced accordingly, and gated behind a demo call. Kironyx gives SMBs the intelligence layer — AI research, scored changes, weekly briefs, and brand monitoring — at $49–$199/month, self-serve."
      rows={ROWS}
      whereWeWin={WHERE_WE_WIN}
      whenTheyWin={WHEN_THEY_WIN}
      faqs={FAQS}
    />
  );
}
