import { Metadata } from "next";
import Link from "next/link";
import {
  Server,
  LockKeyhole,
  KeyRound,
  ScrollText,
  Network,
  Siren,
} from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Kironyx protects your competitive strategy: serverless AWS architecture, tenant isolation, encryption everywhere, audited access, and a 72-hour breach-notification commitment.",
};

const PILLARS = [
  {
    icon: Server,
    title: "Serverless, single-region AWS",
    description:
      "Fully serverless on AWS us-east-1 (Lambda, API Gateway, DynamoDB, Cognito) with no long-running servers to patch. Each workspace's data is logically isolated by tenant key at the data layer, so cross-tenant reads are impossible by construction.",
  },
  {
    icon: LockKeyhole,
    title: "Encryption in transit and at rest",
    description:
      "TLS 1.2+ enforced end to end. DynamoDB and S3 encrypted at rest with AWS KMS. Secrets live in AWS Secrets Manager with quarterly rotation. Passwords are managed entirely by Amazon Cognito, so we never see plaintext. API keys are stored only as SHA-256 hashes.",
  },
  {
    icon: KeyRound,
    title: "Access control",
    description:
      "Customer auth via Cognito with email verification and optional MFA. Workspace roles gate destructive actions to owners. On our side: hardware-MFA root account, explicitly scoped IAM roles with elevated permissions isolated to dedicated functions, and quarterly access reviews.",
  },
  {
    icon: ScrollText,
    title: "Audit logging",
    description:
      "A multi-region CloudTrail with file validation retains every AWS API event for 7 years in an object-locked bucket. In-app audit events record owner-level actions with actor, IP, and user agent.",
  },
  {
    icon: Network,
    title: "Network protection",
    description:
      "Deliberately tight API Gateway throttling, with the strictest limits on the auth endpoints, plus per-API-key quotas and durable rate-limiting on sign-in and email verification. Edge DDoS absorption via AWS Shield Standard; managed WAF rules are staged for public launch.",
  },
  {
    icon: Siren,
    title: "Incident response",
    description:
      "A documented incident runbook with severity definitions and playbooks. Confirmed breaches affecting customer data are notified within 72 hours (GDPR Art. 33). Live system status is published at status.kironyx.com.",
  },
];

const SUB_PROCESSORS = [
  { vendor: "Amazon Web Services", service: "Hosting & infrastructure", certs: "SOC 2 Type II, ISO 27001" },
  { vendor: "Anthropic", service: "Claude AI research", certs: "SOC 2 Type II" },
  { vendor: "Paddle", service: "Payments (merchant of record)", certs: "PCI DSS Level 1, SOC 2 Type II" },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title={
          <>
            Your competitive strategy is{" "}
            <span className="text-gradient-primary">the whole product</span>
          </>
        }
        description="Kironyx knows who you watch and what you're told about them. Here's how that data is protected, in plain language, with the receipts linked."
      />

      {/* What we store / don't store */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-lg border border-ink/[0.08] bg-obsidian-900 p-6 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
              <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-ink/55">
                What we store
              </h2>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink/75">
                <li>Account basics: email, name, plan tier</li>
                <li>Workspace data: competitor URLs, AI analysis, briefings</li>
                <li>Audit trails with 90-day in-app retention</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <div className="h-full rounded-lg border border-ink/[0.08] bg-obsidian-900 p-6 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
              <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-ink/55">
                What we never store
              </h2>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink/75">
                <li>Payment-card data (Paddle is the merchant of record)</li>
                <li>Health data, government IDs, or biometrics</li>
                <li>
                  Dossiers on people: the research classifier blocks attempts
                  to research individuals; we monitor companies
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-t border-ink/[0.06] bg-obsidian-900/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="text-center font-display text-display-m font-medium">
              How it&apos;s protected
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((pillar, index) => (
              <Reveal key={pillar.title} delay={(index % 3) * 60}>
                <div className="h-full rounded-lg border border-ink/[0.08] bg-obsidian-900 p-6 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
                  <pillar.icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-4 font-semibold">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/70">
                    {pillar.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance + sub-processors */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <h2 className="text-center font-display text-display-m font-medium">
              Compliance posture
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-ink/70">
              Shipped today: GDPR data export, deletion, and
              restriction-of-processing; CCPA rights to know and delete; a
              72-hour breach-notification commitment; and a public
              sub-processor list. A SOC 2 Type 1 readiness program is underway:
              we&apos;ll say audited when an auditor has said it, not before.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-10 overflow-x-auto rounded-xl border border-ink/10 shadow-[inset_0_1px_0_rgba(225,217,193,0.08)]">
              <table className="w-full min-w-[480px] border-collapse bg-obsidian-900 text-sm">
                <thead>
                  <tr className="border-b border-ink/[0.08] bg-obsidian-950/60 text-left">
                    <th className="px-5 py-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-ink/55">
                      Key sub-processor
                    </th>
                    <th className="px-5 py-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-ink/55">
                      Service
                    </th>
                    <th className="px-5 py-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-ink/55">
                      Certifications
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/[0.06]">
                  {SUB_PROCESSORS.map((row) => (
                    <tr key={row.vendor}>
                      <td className="px-5 py-3 font-medium text-ink/85">{row.vendor}</td>
                      <td className="px-5 py-3 text-ink/70">{row.service}</td>
                      <td className="px-5 py-3 text-ink/70">{row.certs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 text-center text-sm text-ink/55">
              Full list with regions:{" "}
              <Link href="/legal/sub-processors" className="text-primary hover:underline">
                sub-processor disclosure
              </Link>
              {" · "}
              <Link href="/legal/privacy" className="text-primary hover:underline">
                privacy policy
              </Link>
              {" · "}
              <Link href="/legal/dpa" className="text-primary hover:underline">
                DPA
              </Link>
            </p>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-12 rounded-lg border border-ink/[0.08] bg-obsidian-900 p-6 text-center shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
              <p className="text-sm leading-relaxed text-ink/70">
                Found a vulnerability? Our disclosure policy lives at{" "}
                <span className="font-mono text-ink/85">/.well-known/security.txt</span>
                . Or write directly to{" "}
                <a
                  href="mailto:security@kironyx.com"
                  className="font-mono text-primary hover:underline"
                >
                  security@kironyx.com
                </a>
                . Security questionnaires answered for prospective customers on
                request.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
