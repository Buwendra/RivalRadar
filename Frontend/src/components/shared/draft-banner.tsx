import { AlertTriangle } from "lucide-react";

/**
 * Surfaced at the top of legal pages whose content has not yet been reviewed
 * by counsel. Better than a 404 — demonstrates we're aware of the obligation
 * and operating in good faith while final language is in progress.
 */
export function DraftBanner({ kind }: { kind: "policy" | "agreement" }) {
  return (
    <div className="not-prose mb-6 flex items-start gap-2 rounded-md border border-amber-900/60 bg-amber-950/40 p-3 text-xs text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div>
        <strong className="block text-sm">Draft — pending legal review</strong>
        <p className="mt-1 leading-relaxed">
          This {kind} is an engineering-drafted placeholder while final
          language is being prepared by counsel. The substantive provisions
          below reflect our current operating commitments, but the document
          will be revised before public launch. For any pre-launch questions,
          contact{" "}
          <a href="mailto:legal@rivalscan.com" className="underline">
            legal@rivalscan.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
