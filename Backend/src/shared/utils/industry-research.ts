/**
 * Industry-aware research config. Powers two layered enrichments in
 * `deepResearch()` (see `shared/services/anthropic.ts`):
 *
 *   1. `perCategoryGuidance` — extra sentence(s) appended to each of the
 *      standard 5 categories (news/product/funding/hiring/social) so the
 *      Claude web_search prompt fishes for industry-relevant signal types
 *      *inside* the existing buckets.
 *
 *   2. `contextGuidance` + `label` — populates the 6th `industryContext`
 *      bucket with what matters most for the user's industry (regulatory
 *      filings for Fintech, FDA pipeline for Healthcare, ARR signals for
 *      SaaS, etc.). The label is persisted on the ResearchFinding row so
 *      historical findings keep their original label if the user later
 *      changes industry.
 *
 * Keys MUST match the `INDUSTRIES` literal in
 * `Frontend/src/lib/utils/constants.ts`. Industry "Other" intentionally has
 * no config; `getIndustryConfig` returns null so the prompt drops the
 * industry-specific block entirely and the sixth bucket comes back empty.
 */

import type { ResearchCategory } from '../types/research';

type BaseCategory = Exclude<ResearchCategory, 'industryContext'>;

export interface IndustryResearchConfig {
  /** Display label for the industryContext bucket, e.g. "Regulatory & Compliance". */
  label: string;
  /** Sentence(s) appended to the standard guidance for each of the 5 base categories. */
  perCategoryGuidance: Partial<Record<BaseCategory, string>>;
  /** 3-5 sentences describing what belongs in the industryContext bucket for this industry. */
  contextGuidance: string;
}

export const INDUSTRY_RESEARCH_CONFIGS: Record<string, IndustryResearchConfig> = {
  'SaaS / Software': {
    label: 'ARR & Customer Wins',
    perCategoryGuidance: {
      product: 'Also fish for: API/SDK launches, integration partnerships, developer-experience changes, open-source contributions.',
      funding: 'Also fish for: ARR milestones, growth-stage signals, secondary tenders, customer concentration commentary.',
      hiring: 'Also fish for: senior engineering hires from category-defining companies, GTM-leader moves, design hires hinting at product expansion.',
      social: 'Also fish for: developer advocacy threads, Show HN / Product Hunt activity, founder-narrative tweets, podcast appearances on SaaS-operator shows.',
    },
    contextGuidance:
      "ARR / growth signals: named customer wins, public ARR figures, NRR/churn commentary, paid logo highlights, expansion-revenue claims, customer case studies, analyst-firm placements (Gartner / Forrester / G2), platform certifications, and any developer-ecosystem traction (downloads, GitHub stars, marketplace listings). Anything that signals the trajectory of the SaaS revenue engine that wouldn't fit neatly under generic 'funding' or 'product'.",
  },

  'E-commerce / Retail': {
    label: 'Supply Chain & Retail Metrics',
    perCategoryGuidance: {
      product: 'Also fish for: SKU expansions, private-label launches, seasonal collection drops, sustainability/material certifications.',
      funding: 'Also fish for: inventory-financing rounds, working-capital arrangements, retail-bank partnerships, GMV milestones.',
      news: 'Also fish for: store openings/closings, marketplace platform changes (Amazon/Shopify/TikTok Shop), retail-media network launches.',
      social: 'Also fish for: UGC / unboxing trends, return-rate complaints, influencer partnerships, viral product moments.',
    },
    contextGuidance:
      'Retail & supply-chain signals: gross merchandise volume (GMV), conversion rate hints, customer acquisition cost commentary, fulfillment-center launches/closures, shipping-partner changes, return-rate metrics, in-store-vs-online mix, peak-season (Black Friday / Singles Day) performance, tariff exposure, sustainability supply-chain disclosures, and inventory-management or 3PL partnerships. The numbers and operations details that move retail equity stories.',
  },

  Fintech: {
    label: 'Regulatory & Compliance',
    perCategoryGuidance: {
      product: 'Also fish for: new payment rails, BIN sponsor changes, KYC/AML feature changes, fraud-defense announcements.',
      funding: 'Also fish for: bank-partnership news, capital-adequacy/runway disclosures, payment-volume milestones, MTL/licensing expansions.',
      hiring: 'Also fish for: Chief Compliance Officer / BSA Officer hires, ex-regulator advisory appointments, departures from compliance leadership.',
      news: 'Also fish for: regulator press releases naming the company (CFPB, SEC, FinCEN, OCC, FDIC, FCA, MAS), enforcement actions, consent orders.',
    },
    contextGuidance:
      "Regulatory & compliance posture: enforcement actions, consent orders, regulator filings (SEC, CFPB, FinCEN, OCC, FCA, MAS, RBI etc.), license additions/withdrawals (state MTLs, bank charters, BitLicense, EMI/PI passports), KYC/AML program changes, sponsor-bank changes, court rulings, class actions related to consumer-finance compliance, and SOC 2 / PCI DSS / ISO 27001 certification milestones. Material risk + compliance signal that's specifically regulator-driven.",
  },

  Healthcare: {
    label: 'Clinical & Regulatory',
    perCategoryGuidance: {
      product: 'Also fish for: FDA 510(k) / De Novo / PMA filings, clinical-trial protocol changes, CE mark / TGA / PMDA approvals, device labeling changes.',
      funding: 'Also fish for: payer-contract wins, value-based-care deal terms, Medicare/Medicaid coverage decisions, NIH/SBIR grant awards.',
      hiring: 'Also fish for: Chief Medical Officer / Chief Quality Officer hires, ex-FDA reviewer additions, MSL team expansions.',
      news: 'Also fish for: FDA warning letters, Form 483s, recalls, JAMA/NEJM publication mentions, HIMSS coverage.',
    },
    contextGuidance:
      'Clinical & regulatory posture: clinical-trial enrollment status (Phase I/II/III), trial readouts, FDA / EMA / TGA / PMDA filings + approvals + warning letters, payer coverage decisions (commercial, Medicare CMS, Medicaid), HIPAA breach notifications, peer-reviewed publications, KOL endorsements, and any safety / adverse-event disclosures. The clinical evidence and regulator-pathway story that drives healthcare-company valuations and prescribing decisions.',
  },

  Education: {
    label: 'Accreditation & Outcomes',
    perCategoryGuidance: {
      product: 'Also fish for: curriculum redesigns, AI-tutor or learning-pathway features, accessibility / Section 508 / WCAG changes, language-pack launches.',
      funding: 'Also fish for: enrollment-volume metrics, university or district partnerships, government education contracts (Title I, ESSER).',
      news: 'Also fish for: accreditation grants/withdrawals (SACSCOC / NEASC / WASC / WSCUC / regional bodies), Department of Education actions, Title IV eligibility news.',
      hiring: 'Also fish for: Chief Academic Officer / VP of Learning hires, advisory-board additions from named universities, curriculum-design leadership.',
    },
    contextGuidance:
      'Accreditation & learning-outcomes signals: accreditation status changes, completion / persistence / placement-rate metrics, regulator actions on title IV / federal aid, state-board approvals, learning-outcome studies (RCTs, quasi-experimental research), institutional partnership announcements (named universities, K-12 districts), and any AI-content / academic-integrity controversies. The credibility-and-outcomes signal that determines whether students enroll and credentials transfer.',
  },

  'Marketing / Advertising': {
    label: 'Campaign Performance & Industry Awards',
    perCategoryGuidance: {
      product: 'Also fish for: ad-tech integrations, measurement-platform certifications (MRC, IAB, TAG), creative-format launches (CTV, retail-media).',
      funding: 'Also fish for: holding-company partnerships, named brand wins, account-of-record losses, media-billings figures.',
      hiring: 'Also fish for: Chief Creative Officer / ECD moves, agency-leader hires from competitors, account-team departures.',
      news: 'Also fish for: Cannes Lions / D&AD / One Show wins, Effie Awards, AdAge or Campaign coverage.',
    },
    contextGuidance:
      "Campaign performance & industry recognition: award wins (Cannes Lions, D&AD, One Show, Effie, Webby), named-brand client wins / losses, in-house-agency builds at major brands, media-billings or revenue benchmarks vs holding-company peers, viral / earned-media moments, brand-tracking study mentions (Kantar / YouGov / Ipsos), and IAB / MRC / TAG certifications. The peer-credibility signal that drives the next pitch invitation.",
  },

  'Media / Entertainment': {
    label: 'Audience Metrics & Distribution',
    perCategoryGuidance: {
      product: 'Also fish for: streaming-platform launches, content-series renewals, format-license deals, AI-content tooling moves.',
      funding: 'Also fish for: content-fund raises, licensing-revenue deals, output-deal renewals, slate-financing arrangements.',
      news: 'Also fish for: Nielsen / Parrot Analytics / Luminate rankings, box-office openings, day-and-date releases, festival selections (Sundance / Cannes / TIFF / SXSW).',
      hiring: 'Also fish for: showrunner deals, executive producer moves, head-of-content hires.',
    },
    contextGuidance:
      'Audience reach & distribution signals: subscriber numbers, time-spent / minutes-watched benchmarks, Nielsen / Parrot Analytics / Luminate / Box Office Mojo / Vivendi ratings, theatrical-vs-streaming windowing announcements, distribution-deal renewals (cable, OTT, syndication), guild/union actions (WGA / SAG-AFTRA / DGA), and any audience-trust or brand-safety incidents. The reach-and-monetisation story that drives ad rates, subscriber growth, and content-deal valuations.',
  },

  'Real Estate': {
    label: 'Market Conditions & Inventory',
    perCategoryGuidance: {
      product: 'Also fish for: listing-platform features, mortgage-origination changes, iBuyer pricing-model changes, brokerage-tech launches.',
      funding: 'Also fish for: cap-rate commentary, REIT distribution changes, property-acquisition or disposition announcements, debt-refinancing terms.',
      news: 'Also fish for: market-by-market price reports (Case-Shiller, CoreLogic, Zillow), inventory trends, mortgage-rate impacts, eviction-rate disclosures.',
      hiring: 'Also fish for: head-of-construction / chief-development-officer hires, large brokerage-team moves between firms.',
    },
    contextGuidance:
      'Market conditions & inventory signals: regional pricing trends (Case-Shiller, CoreLogic, Zillow Home Value Index), days-on-market, listing-to-sale ratios, mortgage application volumes, cap rates, vacancy rates (residential & commercial), construction-starts data, regulatory zoning changes (rent control, ADU rules), and any property-tax assessment changes. The macro context that determines whether a real-estate business is operating with a tailwind or headwind.',
  },

  'Travel / Hospitality': {
    label: 'Booking Trends & Occupancy',
    perCategoryGuidance: {
      product: 'Also fish for: loyalty-program restructures, route launches/cuts (airlines), hotel-flag conversions, sustainability/carbon-offset features.',
      funding: 'Also fish for: revenue-per-available-room (RevPAR) results, load-factor announcements, ancillary-revenue benchmarks, distressed-asset purchases.',
      news: 'Also fish for: OAG / IATA / STR / Phocuswright market reports, travel-restriction lifts/imposes, named-incident coverage (cyber, safety, weather).',
      hiring: 'Also fish for: revenue-management leadership moves, chief-distribution-officer hires, loyalty-program leaders.',
    },
    contextGuidance:
      'Booking trends & operational metrics: RevPAR / ADR / occupancy (hotels), load factor / ASK / RPK (airlines), forward-booking curves, ancillary-revenue mix, distribution-channel shifts (direct vs OTA), loyalty-program redemption rates, named-incident impact (cyber, safety, weather, geopolitical), and sustainability/carbon disclosures (CORSIA, SBTi). The operations + demand signal that determines whether the booking engine is filling rooms and seats.',
  },
};

export function getIndustryConfig(industry?: string): IndustryResearchConfig | null {
  if (!industry || industry === 'Other') return null;
  return INDUSTRY_RESEARCH_CONFIGS[industry] ?? null;
}
