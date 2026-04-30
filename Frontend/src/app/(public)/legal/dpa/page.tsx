import { DraftBanner } from "@/components/shared/draft-banner";

export const metadata = {
  title: "Data Processing Agreement — RivalScan",
};

export default function DpaPage() {
  return (
    <>
      <h1>Data Processing Agreement</h1>
      <p className="text-xs text-muted-foreground">Last updated: 2026-04-30</p>

      <DraftBanner kind="agreement" />

      <h2>Overview</h2>
      <p>
        For B2B customers subject to GDPR (EU/UK), CCPA (California), or
        comparable data-protection regulations, a Data Processing Agreement
        (&quot;DPA&quot;) is available upon request. The DPA covers:
      </p>
      <ul>
        <li>Roles of the parties (controller / processor)</li>
        <li>Subject matter, duration, and nature of processing</li>
        <li>Categories of personal data and data subjects</li>
        <li>Security measures (Art. 32 GDPR)</li>
        <li>Sub-processor terms (incorporating our published sub-processor list)</li>
        <li>Standard Contractual Clauses (SCCs) for international transfers</li>
        <li>Audit rights and breach notification (within 72 hours per Art. 33 GDPR)</li>
        <li>Data subject rights assistance</li>
      </ul>

      <h2>Requesting the DPA</h2>
      <p>
        Email{" "}
        <a href="mailto:legal@rivalscan.com">legal@rivalscan.com</a> with your
        company name, the responsible contact for the agreement, and your
        country of operation. We will counter-sign and return within 5
        business days.
      </p>

      <h2>Self-service signing</h2>
      <p>
        A standard self-service DPA portal is in development and will be
        available at this URL when ready. In the interim, the email-based
        process above is fully sufficient for compliance purposes.
      </p>
    </>
  );
}
