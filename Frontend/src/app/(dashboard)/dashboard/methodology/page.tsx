/**
 * Methodology / "How the scores work" page.
 *
 * Static, ungated (available on every plan) transparency surface. All content
 * is driven by `lib/content/methodology.ts` so this page and the inline ⓘ
 * score explainers stay in sync. No client hooks → renders as a server
 * component.
 */

import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AiDisclaimer } from "@/components/dashboard/ai-disclaimer";
import { METHODOLOGY, type MetricDoc } from "@/lib/content/methodology";

export const metadata: Metadata = {
  title: "Methodology — RivalScan",
  description: "How RivalScan computes its threat, momentum, Brand Health, Share of Voice, and significance scores.",
};

function ProvenanceBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-brand-700 bg-brand-800 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {text}
    </span>
  );
}

function MetricSection({ doc }: { doc: MetricDoc }) {
  return (
    <Card id={doc.anchor} className="scroll-mt-24 border-brand-700 bg-brand-900">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{doc.title}</h2>
          <ProvenanceBadge text={doc.provenance} />
        </div>

        <p className="text-sm text-muted-foreground">{doc.oneLiner}</p>

        {doc.formula && (
          <pre className="overflow-x-auto rounded-md border border-brand-700 bg-brand-950 px-4 py-3 text-xs text-foreground">
            <code>{doc.formula}</code>
          </pre>
        )}

        {doc.rubric && doc.rubric.length > 0 && (
          <div className="overflow-hidden rounded-md border border-brand-700">
            <table className="w-full text-sm">
              <tbody>
                {doc.rubric.map((row, i) => (
                  <tr
                    key={row.label}
                    className={i % 2 === 0 ? "bg-brand-900" : "bg-brand-950/40"}
                  >
                    <th className="w-40 whitespace-nowrap border-r border-brand-700 px-4 py-2 text-left align-top font-medium">
                      {row.label}
                    </th>
                    <td className="px-4 py-2 align-top text-muted-foreground">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {doc.notes && doc.notes.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {doc.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function MethodologyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Methodology"
        description="How every score in RivalScan is calculated — so you can judge the numbers, not just read them."
      />

      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
          <p>
            Each score is computed from the signals gathered in every research cycle. Most are
            deterministic rules; <strong className="text-foreground">Threat level</strong> and{" "}
            <strong className="text-foreground">Significance</strong> are assigned by an AI model
            against a fixed rubric. <strong className="text-foreground">Share of Voice</strong> is a
            standard marketing measure; the rest are internal indicators, not externally certified
            ratings.
          </p>
          <p>
            They are decision aids, not guarantees — always check the underlying sources (cited on
            every finding) before acting on a number.
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            {METHODOLOGY.map((m) => (
              <a
                key={m.key}
                href={`#${m.anchor}`}
                className="text-xs text-foreground underline-offset-4 hover:underline"
              >
                {m.title}
              </a>
            ))}
          </nav>
        </CardContent>
      </Card>

      {METHODOLOGY.map((doc) => (
        <MetricSection key={doc.key} doc={doc} />
      ))}

      <AiDisclaimer />
    </div>
  );
}
