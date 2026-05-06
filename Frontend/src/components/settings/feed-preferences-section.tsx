"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Filter } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/use-auth";
import { usersApi } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";

const STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function FeedPreferencesSection() {
  const { user, refreshUser } = useAuth();
  const initial = user?.feedSignificanceThreshold ?? 0;
  const [value, setValue] = useState<number>(initial);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await usersApi.updateProfile({ feedSignificanceThreshold: value });
      await refreshUser();
      toast.success("Feed threshold saved");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Failed to save";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Feed threshold
        </CardTitle>
        <CardDescription>
          Hide changes below this significance from the dashboard and the weekly
          digest. Critical alerts (significance ≥ 8) ignore this setting and
          always come through. Shared with everyone in the workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="threshold-input" className="text-xs uppercase tracking-wide text-muted-foreground">
            Minimum significance
          </Label>
          <input
            id="threshold-input"
            type="range"
            min={0}
            max={10}
            step={1}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            {STEPS.map((s) => (
              <span key={s} className={s === value ? "font-semibold text-primary" : undefined}>
                {s}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Currently showing changes with significance{" "}
            <strong className="text-foreground">≥ {value}</strong>.
            {value === 0 && " (no filter applied)"}
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || value === initial}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save threshold
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
