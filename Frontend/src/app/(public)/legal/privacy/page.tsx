import { DraftBanner } from "@/components/shared/draft-banner";

export const metadata = {
  title: "Privacy Policy — RivalScan",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-xs text-muted-foreground">Last updated: 2026-04-30</p>

      <DraftBanner kind="policy" />

      <h2>1. Who we are</h2>
      <p>
        RivalScan is operated by RivalScan Inc. (the &quot;Company&quot;,
        &quot;we&quot;, &quot;us&quot;). This Privacy Policy describes how we
        collect, use, and share information about you when you use the
        RivalScan service.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — your email address, name, company
          name, and industry, captured at sign-up and onboarding.
        </li>
        <li>
          <strong>Authentication data</strong> — credentials are managed by
          Amazon Cognito; we never store passwords directly.
        </li>
        <li>
          <strong>Subscription &amp; billing data</strong> — handled by Paddle
          as merchant of record. We see only the customer ID, plan, and status;
          we never see your card details.
        </li>
        <li>
          <strong>Usage data</strong> — competitors you choose to track, the
          research and analyses we perform on your behalf, and your interactions
          with the dashboard.
        </li>
        <li>
          <strong>Operational logs</strong> — request metadata, IP address, and
          error context retained for security and debugging purposes.
        </li>
      </ul>

      <h2>3. Why we collect it (lawful basis under GDPR Art. 6)</h2>
      <ul>
        <li>
          <strong>Contractual necessity</strong> — to provide the service you
          subscribed to.
        </li>
        <li>
          <strong>Legitimate interest</strong> — to operate, secure, and
          improve the service.
        </li>
        <li>
          <strong>Legal obligation</strong> — tax, sanctions screening, and
          accounting records.
        </li>
        <li>
          <strong>Consent</strong> — for any optional marketing communications,
          with the right to withdraw at any time.
        </li>
      </ul>

      <h2>4. AI processing disclosure</h2>
      <p>
        RivalScan uses Anthropic&apos;s Claude API to perform competitive
        research and analysis. Your competitors&apos; names and URLs (which you
        provide) are sent to Anthropic to enable the research function.
        Anthropic does not use this data to train their models. See our{" "}
        <a href="/legal/sub-processors">sub-processor list</a> for the full
        list of third parties that process data on our behalf.
      </p>

      <h2>5. Data retention</h2>
      <p>
        Research findings, change records, and competitor records are retained
        while your account is active. Upon account deletion (see Section 7),
        your personal data is erased within 30 days, except where retention is
        required for tax or legal obligations (typically up to 6 years for
        invoicing records).
      </p>

      <h2>6. International transfers</h2>
      <p>
        Our infrastructure is hosted in the United States (AWS us-east-1).
        Where we transfer personal data outside your jurisdiction (e.g., from
        the EU/UK to the US), we rely on Standard Contractual Clauses (SCCs)
        approved by the European Commission.
      </p>

      <h2>7. Your rights</h2>
      <ul>
        <li>
          <strong>Right to access</strong> (GDPR Art. 15 / CCPA §1798.110) — request
          a machine-readable export of your data via the dashboard or by
          emailing privacy@rivalscan.com.
        </li>
        <li>
          <strong>Right to erasure</strong> (GDPR Art. 17 / CCPA §1798.105) —
          delete your account from the settings page or by emailing us.
        </li>
        <li>
          <strong>Right to rectification</strong> (GDPR Art. 16) — edit your
          profile fields directly in the dashboard.
        </li>
        <li>
          <strong>Right to portability</strong> (GDPR Art. 20) — your data
          export is provided as JSON suitable for porting.
        </li>
        <li>
          <strong>Right to object / restriction</strong> — contact us at
          privacy@rivalscan.com.
        </li>
        <li>
          <strong>Right to lodge a complaint</strong> — with the supervisory
          authority in your country of residence.
        </li>
      </ul>

      <h2>8. Cookies &amp; storage</h2>
      <p>
        We use browser <code>localStorage</code> to keep you signed in. We do
        not set tracking cookies. See the storage notice on first visit for
        details.
      </p>

      <h2>9. Security</h2>
      <p>
        Data is encrypted in transit via TLS, encrypted at rest by AWS-managed
        keys, and access is restricted by role-based controls. We follow the
        security commitments described in our{" "}
        <a href="/legal/sub-processors">sub-processor list</a>.
      </p>

      <h2>10. Children</h2>
      <p>
        RivalScan is a B2B service not intended for individuals under 16. If
        you believe a minor has created an account, contact us so we can erase
        the data.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        Material changes will be communicated to active users by email at
        least 14 days before they take effect. Version history is published at
        the top of this document.
      </p>

      <h2>12. Contact</h2>
      <p>
        Privacy inquiries: <a href="mailto:privacy@rivalscan.com">privacy@rivalscan.com</a>.
        Data Protection Officer (for EU/UK data subjects):{" "}
        <a href="mailto:dpo@rivalscan.com">dpo@rivalscan.com</a>.
      </p>
    </>
  );
}
