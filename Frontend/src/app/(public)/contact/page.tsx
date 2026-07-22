import { Metadata } from "next";
import { Mail, ShieldCheck, Lock, Scale } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Kironyx team — support, security disclosures, privacy requests, and legal questions.",
};

const CHANNELS = [
  {
    icon: Mail,
    title: "Support & general",
    email: "support@kironyx.com",
    description:
      "Product questions, billing, feedback, or anything that doesn't fit the boxes below. We're a small team — a human reads everything.",
  },
  {
    icon: ShieldCheck,
    title: "Security",
    email: "security@kironyx.com",
    description:
      "Vulnerability reports and security questions. Our disclosure policy is published at /.well-known/security.txt per RFC 9116.",
  },
  {
    icon: Lock,
    title: "Privacy",
    email: "privacy@kironyx.com",
    description:
      "Data-subject requests (export, deletion, restriction), GDPR/CCPA questions, and anything covered by our Privacy Policy.",
  },
  {
    icon: Scale,
    title: "Legal",
    email: "legal@kironyx.com",
    description:
      "Terms, DPA, and contract questions.",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to a human"
        description="No chatbots, no ticket deflection. Pick the right inbox and we'll get back to you."
      />

      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          {CHANNELS.map((channel, index) => (
            <Reveal key={channel.email} delay={(index % 2) * 60}>
              <div className="h-full rounded-lg border border-ink/[0.08] bg-obsidian-900 p-6 shadow-[inset_0_1px_0_rgba(225,217,193,0.06)]">
                <channel.icon className="h-6 w-6 text-primary" />
                <h2 className="mt-4 font-semibold">{channel.title}</h2>
                <a
                  href={`mailto:${channel.email}`}
                  className="mt-1 inline-block font-mono text-sm text-primary hover:underline"
                >
                  {channel.email}
                </a>
                <p className="mt-3 text-sm leading-relaxed text-ink/70">
                  {channel.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
