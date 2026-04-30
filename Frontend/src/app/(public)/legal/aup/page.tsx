export const metadata = {
  title: "Acceptable Use Policy — RivalScan",
};

export default function AupPage() {
  return (
    <>
      <h1>Acceptable Use Policy</h1>
      <p className="text-xs text-muted-foreground">Last updated: 2026-04-30</p>

      <p>
        This Acceptable Use Policy (&quot;AUP&quot;) applies to all use of the
        RivalScan service. It is incorporated by reference into the{" "}
        <a href="/legal/terms">Terms of Service</a>. Violation results in
        account termination and may be reported to law enforcement. The list
        below is non-exhaustive — RivalScan retains discretion to determine
        what constitutes misuse.
      </p>

      <h2>Prohibited uses</h2>

      <h3>1. Personal individual research</h3>
      <p>
        Researching natural persons (employees, executives, public figures)
        outside of their professional capacity at a clearly-identified
        business entity. Targets must be incorporated companies. The system
        screens new entries automatically and rejects person-named targets.
      </p>

      <h3>2. Sanctioned entities</h3>
      <p>
        Researching individuals or entities on the U.S. OFAC SDN list, EU
        Consolidated Sanctions list, UK HMT sanctions list, or comparable
        national sanctions registries. The system screens against a denylist
        of known sanctioned domains and rejects matches automatically.
      </p>

      <h3>3. Stalking, harassment, or doxxing</h3>
      <p>
        Using research output to harm, embarrass, threaten, or surveil any
        person. This includes academic, romantic, journalistic, or
        professional contexts that target individuals rather than businesses.
      </p>

      <h3>4. Trading decisions</h3>
      <p>
        Using research output as the basis for securities trading. RivalScan
        is not a registered investment advisor and outputs may be inaccurate.
        Use of the service for trading-decision input violates this AUP and
        may also constitute violations of securities laws.
      </p>

      <h3>5. Redistribution of AI output</h3>
      <p>
        Republishing, broadcasting, or commercializing
        RivalScan-generated text without explicit written permission. Quoting
        small excerpts internally is permitted; large-scale extraction or
        commercial republishing is not.
      </p>

      <h3>6. Competitive intelligence on protected categories</h3>
      <p>
        Targeted research designed to identify employees by race, gender,
        religion, disability, age, sexual orientation, or other status
        protected under anti-discrimination law in your jurisdiction.
      </p>

      <h3>7. Trade secret misappropriation</h3>
      <p>
        Attempting to extract or summarize confidentially-held information of
        another party (leaked documents, breached materials, unpublished
        filings, NDA-bound material). Public web research is permitted; the
        line between &quot;public&quot; and &quot;leaked but findable&quot; is
        yours to enforce.
      </p>

      <h3>8. Defamation</h3>
      <p>
        Using RivalScan output as the basis for false, damaging public
        statements about any person or entity. AI-generated content can
        contain errors; you are responsible for verifying material claims
        before any external use.
      </p>

      <h3>9. Automated mass research</h3>
      <p>
        Scripting or automating the research API beyond what individual
        interactive use requires. Rate limits per plan tier are documented in
        the dashboard. Programmatic / volume access requires written
        permission.
      </p>

      <h3>10. Resale of access</h3>
      <p>
        Sharing accounts, reselling credentials, or providing the service to
        third parties under your own account. Each account is for use by a
        single human individual.
      </p>

      <h2>How violations are handled</h2>
      <ul>
        <li>
          <strong>Detection</strong> — automatic input screening rejects
          person-named or sanctioned targets at submission time. Behavioral
          patterns are reviewed for severity.
        </li>
        <li>
          <strong>Suspension</strong> — accounts found in violation may be
          suspended immediately, with research access disabled.
        </li>
        <li>
          <strong>Investigation</strong> — we may review server logs related
          to the violation. We do not read user research content
          speculatively.
        </li>
        <li>
          <strong>Termination &amp; data deletion</strong> — confirmed
          violations result in account termination per Section 9 of the
          Terms of Service. Data is erased per the Privacy Policy.
        </li>
        <li>
          <strong>Law enforcement referral</strong> — for violations involving
          sanctions evasion, stalking, or other criminal activity, we will
          cooperate with law enforcement requests subject to applicable law.
        </li>
      </ul>

      <h2>Reporting violations</h2>
      <p>
        If you believe another user is misusing the service, email{" "}
        <a href="mailto:abuse@rivalscan.com">abuse@rivalscan.com</a> with
        details. Reports are reviewed within 5 business days.
      </p>

      <h2>Questions</h2>
      <p>
        Edge cases or clarifications:{" "}
        <a href="mailto:legal@rivalscan.com">legal@rivalscan.com</a>.
      </p>
    </>
  );
}
