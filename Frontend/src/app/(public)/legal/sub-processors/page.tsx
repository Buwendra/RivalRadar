export const metadata = {
  title: "Sub-processors — RivalScan",
};

export default function SubProcessorsPage() {
  return (
    <>
      <h1>Sub-processors</h1>
      <p className="text-xs text-muted-foreground">Last updated: 2026-04-30</p>

      <p>
        RivalScan engages the third-party sub-processors below to provide our
        service. This list is published in fulfillment of GDPR Art. 28(2)
        transparency requirements and equivalent obligations under other
        privacy regimes.
      </p>

      <h2>Current sub-processors</h2>

      <div className="not-prose overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-700 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4">Sub-processor</th>
              <th className="py-2 pr-4">Purpose</th>
              <th className="py-2 pr-4">Region</th>
              <th className="py-2">Compliance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-brand-700/60">
              <td className="py-3 pr-4 align-top font-medium">
                Amazon Web Services (AWS)
              </td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                Application hosting (Lambda, DynamoDB, S3, Cognito, API
                Gateway, Step Functions, SES, Secrets Manager, CloudWatch)
              </td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                us-east-1 (N. Virginia)
              </td>
              <td className="py-3 align-top text-muted-foreground">
                SOC 2 Type II, ISO 27001, ISO 27017, ISO 27018
              </td>
            </tr>
            <tr className="border-b border-brand-700/60">
              <td className="py-3 pr-4 align-top font-medium">AWS Amplify</td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                Frontend hosting and CI/CD
              </td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                us-east-1
              </td>
              <td className="py-3 align-top text-muted-foreground">
                Inherits AWS compliance posture
              </td>
            </tr>
            <tr className="border-b border-brand-700/60">
              <td className="py-3 pr-4 align-top font-medium">Anthropic</td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                AI model API (Claude Sonnet 4.5, Haiku 4.5, web_search tool)
              </td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                US infrastructure
              </td>
              <td className="py-3 align-top text-muted-foreground">
                SOC 2 Type II
              </td>
            </tr>
            <tr className="border-b border-brand-700/60">
              <td className="py-3 pr-4 align-top font-medium">Paddle</td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                Payment processing and merchant of record (subscriptions,
                tax, billing)
              </td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                UK / EU global
              </td>
              <td className="py-3 align-top text-muted-foreground">
                PCI DSS Level 1, SOC 2 Type II
              </td>
            </tr>
            <tr className="border-b border-brand-700/60">
              <td className="py-3 pr-4 align-top font-medium">GitHub</td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                Source code hosting; CI integration with Amplify
              </td>
              <td className="py-3 pr-4 align-top text-muted-foreground">
                US
              </td>
              <td className="py-3 align-top text-muted-foreground">
                SOC 1/2/3 Type II, ISO 27001
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>What data each sub-processor sees</h2>
      <ul>
        <li>
          <strong>AWS</strong> sees all customer data (it hosts our database
          and storage). All data is encrypted at rest and in transit. AWS does
          not access customer data except as required to operate the
          infrastructure.
        </li>
        <li>
          <strong>Anthropic</strong> sees the prompts we send (containing
          competitor names, URLs, and our internal research/analysis context).
          Anthropic does not use this data for model training. We never send
          Anthropic our customers&apos; account credentials, billing data, or
          email contents.
        </li>
        <li>
          <strong>Paddle</strong> sees billing-related data (your name, email,
          billing address, payment method, transaction history). They do not
          see your competitor list or research content.
        </li>
        <li>
          <strong>GitHub</strong> sees our application source code. They do
          not see customer data — only commits to our internal repository.
        </li>
      </ul>

      <h2>Notification of changes</h2>
      <p>
        Per GDPR Art. 28(2), customers will be notified by email of any new
        sub-processors at least 30 days before that sub-processor begins
        processing personal data, with an opportunity to object. To subscribe
        to change notifications, email{" "}
        <a href="mailto:privacy@rivalscan.com">privacy@rivalscan.com</a> with
        subject &quot;sub-processor updates&quot;.
      </p>

      <h2>Questions</h2>
      <p>
        For sub-processor due-diligence requests, copies of executed
        Standard Contractual Clauses, or specific compliance documentation
        beyond what&apos;s listed above, contact{" "}
        <a href="mailto:legal@rivalscan.com">legal@rivalscan.com</a>.
      </p>
    </>
  );
}
