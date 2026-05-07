"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCapability } from "@/lib/hooks/use-capability";
import { useGenerateBattlecard } from "@/lib/hooks/use-battlecards";
import { ApiClientError } from "@/lib/api/client";
import { BattlecardShareDialog } from "./battlecard-share-dialog";
import type { BattlecardSummary } from "@/lib/types";

interface BattlecardButtonProps {
  competitorId: string;
}

export function BattlecardButton({ competitorId }: BattlecardButtonProps) {
  const allowed = useCapability("pdfExports");
  const generate = useGenerateBattlecard();
  const [open, setOpen] = useState(false);
  const [primary, setPrimary] = useState<BattlecardSummary | undefined>();

  if (!allowed) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard/settings?tab=billing">
          <Lock className="mr-1.5 h-3.5 w-3.5" />
          Battlecard (upgrade)
        </Link>
      </Button>
    );
  }

  const handleGenerate = async () => {
    try {
      const result = await generate.mutateAsync(competitorId);
      setPrimary(result);
      setOpen(true);
      toast.success("Battlecard generated");
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : "Battlecard generation failed";
      toast.error(msg);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={generate.isPending}
      >
        {generate.isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="mr-1.5 h-3.5 w-3.5" />
        )}
        Battlecard
      </Button>
      <BattlecardShareDialog
        open={open}
        onOpenChange={setOpen}
        competitorId={competitorId}
        primary={primary}
      />
    </>
  );
}
