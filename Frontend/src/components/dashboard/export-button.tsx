"use client";

import { useState } from "react";
import { Download, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCapability } from "@/lib/hooks/use-capability";
import { exportsApi, triggerCsvDownload, type CsvExportType } from "@/lib/api/exports";
import { ApiClientError } from "@/lib/api/client";
import Link from "next/link";

interface ExportButtonProps {
  /** Restrict the dropdown to a single type (e.g. "changes" on the changes page). */
  only?: CsvExportType;
  /** Compact "icon only" variant for crowded toolbars. */
  variant?: "default" | "compact";
}

const TYPE_LABELS: Record<CsvExportType, string> = {
  changes: "Changes (last 90 days)",
  competitors: "Competitors",
  recommendations: "Recommendations",
};

export function ExportButton({ only, variant = "default" }: ExportButtonProps) {
  const allowed = useCapability("csvExports");
  const [busyType, setBusyType] = useState<CsvExportType | null>(null);

  // Locked state — Scout tier sees the button but it routes to the upgrade page.
  if (!allowed) {
    return (
      <Button asChild variant="outline" size={variant === "compact" ? "sm" : "default"}>
        <Link href="/dashboard/settings?tab=billing">
          <Lock className="mr-2 h-4 w-4" />
          Export (upgrade)
        </Link>
      </Button>
    );
  }

  const handleExport = async (type: CsvExportType) => {
    setBusyType(type);
    try {
      const result = await exportsApi.csv(type);
      triggerCsvDownload({ csv: result.csv, filename: result.filename });
      toast.success(
        `Exported ${result.rowCount} ${type} record${result.rowCount === 1 ? "" : "s"}`
      );
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Export failed";
      toast.error(msg);
    } finally {
      setBusyType(null);
    }
  };

  // Single-type variant: render as a direct button, not a dropdown.
  if (only) {
    const isBusy = busyType === only;
    return (
      <Button
        variant="outline"
        size={variant === "compact" ? "sm" : "default"}
        onClick={() => handleExport(only)}
        disabled={isBusy}
      >
        {isBusy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Export CSV
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={variant === "compact" ? "sm" : "default"}
          disabled={busyType !== null}
        >
          {busyType !== null ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(TYPE_LABELS) as CsvExportType[]).map((type) => (
          <DropdownMenuItem key={type} onClick={() => handleExport(type)}>
            <Download className="mr-2 h-3.5 w-3.5" />
            {TYPE_LABELS[type]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
