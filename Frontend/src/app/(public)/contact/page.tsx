import { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { RequestAccessForm } from "@/components/marketing/request-access-form";
import { Dateline } from "@/components/marketing/editorial";

export const metadata: Metadata = {
  title: "Request access",
  description:
    "Kironyx runs the same deep research on you and your competitors, then files the gap every Monday. Tell us who you're up against and we'll set up your workspace.",
};

const CHANNELS = [
  {
    label: "Support & general",
    email: "support@kironyx.com",
    note: "Product questions, billing, anything else. A human reads everything.",
  },
  {
    label: "Security",
    email: "security@kironyx.com",
    note: "Vulnerability reports. Disclosure policy at /.well-known/security.txt.",
  },
  {
    label: "Privacy",
    email: "privacy@kironyx.com",
    note: "Data-subject requests, GDPR/CCPA questions.",
  },
  {
    label: "Legal",
    email: "legal@kironyx.com",
    note: "Terms, DPA, and contract questions.",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Access"
        title="Request access"
        description="We're onboarding new workspaces by invitation while we get ready for launch. Tell us who you're benchmarking against and we'll set you up and send your first brief."
      />

      <section className="px-6 pb-28 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
          <RequestAccessForm />

          <aside className="lg:pt-2">
            <Dateline>Direct lines</Dateline>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground measure-tight">
              Not requesting access? Reach the right desk directly. No chatbots,
              no ticket deflection.
            </p>
            <dl className="mt-8 space-y-6">
              {CHANNELS.map((channel) => (
                <div key={channel.email}>
                  <dt className="font-mono text-label uppercase text-muted-foreground">
                    {channel.label}
                  </dt>
                  <dd className="mt-1.5">
                    <a
                      href={`mailto:${channel.email}`}
                      className="font-mono text-sm text-foreground underline underline-offset-2 hover:text-foreground/80"
                    >
                      {channel.email}
                    </a>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {channel.note}
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>
    </>
  );
}
