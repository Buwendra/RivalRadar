"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, FileText, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api/client";
import { useBulkImportCompetitors } from "@/lib/hooks/use-competitors";
import { useCompetitors } from "@/lib/hooks/use-competitors";
import { useAuth } from "@/lib/auth/use-auth";
import { PLAN_LIMITS } from "@/lib/utils/plan-limits";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXAMPLE_CSV = `name,url,pagesToTrack
Acme,https://acme.example,pricing;features
Globex,https://globex.example,
Initech,https://initech.example,homepage;pricing;blog`;

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const { user } = useAuth();
  const { data: competitors = [] } = useCompetitors();
  const importMutation = useBulkImportCompetitors();
  const [csv, setCsv] = useState("");
  const [skipIneligible, setSkipIneligible] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const planMax = user?.plan ? PLAN_LIMITS[user.plan].maxCompetitors : 0;
  const remaining = Math.max(0, planMax - competitors.length);

  // Lightweight client-side row count for live feedback. The backend does the
  // authoritative parse + validation; this is just a teaser.
  const rowCount = useMemo(() => {
    if (!csv.trim()) return 0;
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return Math.max(0, lines.length - 1); // exclude header
  }, [csv]);

  const exceedsCap = rowCount > remaining;

  const handleSubmit = async () => {
    setRowErrors({});
    if (!csv.trim()) {
      toast.error("Paste or upload a CSV first");
      return;
    }
    try {
      const result = await importMutation.mutateAsync({ csv, skipIneligible });
      const skippedCount = result.skipped.length;
      toast.success(
        skippedCount > 0
          ? `Imported ${result.imported}, skipped ${skippedCount}`
          : `Imported ${result.imported} competitor${result.imported === 1 ? "" : "s"}`
      );
      setCsv("");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "CSV_ROW_ERRORS" && err.details) {
          setRowErrors(err.details);
          toast.error(err.message);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Failed to import");
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bulk import competitors
          </DialogTitle>
          <DialogDescription>
            Paste a CSV with{" "}
            <code className="font-mono text-foreground">name</code>,{" "}
            <code className="font-mono text-foreground">url</code>, and optional{" "}
            <code className="font-mono text-foreground">pagesToTrack</code>{" "}
            (semicolon-separated). Upload from a file or paste directly. You
            currently have {competitors.length}/{planMax} slots used.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 rounded-md border border-brand-700 bg-brand-950/50 px-3 py-1.5 text-xs hover:bg-brand-800">
                <Upload className="h-3 w-3" /> Upload CSV
              </span>
            </Label>
            <span className="text-xs text-muted-foreground">or paste below</span>
          </div>

          <Textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setRowErrors({});
            }}
            rows={10}
            className="bg-brand-950/40 font-mono text-xs"
            placeholder="name,url,pagesToTrack&#10;Acme,https://acme.example,pricing;features&#10;..."
            disabled={importMutation.isPending}
          />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {rowCount} data row{rowCount === 1 ? "" : "s"} detected
              {rowCount > 0 && remaining > 0 && (
                <>
                  {" · "}
                  {remaining} slot{remaining === 1 ? "" : "s"} remaining on your plan
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => setShowExample(!showExample)}
              className="text-primary hover:underline"
            >
              {showExample ? "Hide" : "Show"} example
            </button>
          </div>

          {showExample && (
            <pre className="rounded-md border border-brand-700/60 bg-brand-950/40 p-3 font-mono text-[11px] text-muted-foreground">
              {EXAMPLE_CSV}
            </pre>
          )}

          {exceedsCap && (
            <div className="flex items-start gap-2 rounded-md border border-amber-900/60 bg-amber-950/30 p-3 text-xs text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Your CSV has {rowCount} rows but only {remaining} slot{remaining === 1 ? "" : "s"} remain
                on your {user?.plan ?? "current"} plan. Trim the CSV or upgrade.
              </div>
            </div>
          )}

          {Object.keys(rowErrors).length > 0 && (
            <div className="rounded-md border border-red-900/60 bg-red-950/20 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-red-300">
                <AlertCircle className="h-3 w-3" />
                Row errors — fix these and resubmit, or check &ldquo;skip invalid&rdquo;
              </div>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px] text-red-200">
                {Object.entries(rowErrors).map(([row, reason]) => (
                  <li key={row}>
                    <strong className="font-mono">{row}:</strong> {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="skip-ineligible"
              checked={skipIneligible}
              onCheckedChange={(v) => setSkipIneligible(v === true)}
              disabled={importMutation.isPending}
            />
            <Label htmlFor="skip-ineligible" className="cursor-pointer text-xs text-muted-foreground">
              Skip invalid rows instead of rejecting the whole batch
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={importMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={importMutation.isPending || !csv.trim() || exceedsCap}
          >
            {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
