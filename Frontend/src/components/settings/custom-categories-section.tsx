"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2, Lock, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth/use-auth";
import { useCapability } from "@/lib/hooks/use-capability";
import { usersApi } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import Link from "next/link";

const MAX_CATEGORIES = 3;

/**
 * Phase 6a — Command-tier exclusive settings card. Lets users define up to
 * 3 strategic focus areas (e.g. "ABM strategy", "channel partnerships") that
 * the recommendation generator threads into its Sonnet prompt to bias output
 * toward themes the user explicitly cares about.
 *
 * Shown locked on lower tiers with an upgrade CTA — keeps the capability
 * visible as upgrade pressure rather than hiding it entirely.
 */
export function CustomCategoriesSection() {
  const allowed = useCapability("customRecommendationCategories");
  const { user, refreshUser } = useAuth();
  const [draft, setDraft] = useState<string[]>(
    user?.customRecommendationCategories ?? []
  );
  const [newCategory, setNewCategory] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify(user?.customRecommendationCategories ?? []);

  if (!allowed) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Custom focus areas</CardTitle>
            <Badge variant="outline" className="text-xs">Command</Badge>
          </div>
          <CardDescription>
            On Command, define up to 3 strategic themes (e.g. &quot;ABM
            strategy&quot;, &quot;channel partnerships&quot;) and we&apos;ll
            bias your weekly recommendations toward them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard/settings?tab=billing">Upgrade to Command</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleAdd = () => {
    const v = newCategory.trim();
    if (!v) return;
    if (draft.length >= MAX_CATEGORIES) {
      toast.error(`Up to ${MAX_CATEGORIES} focus areas`);
      return;
    }
    if (draft.some((c) => c.toLowerCase() === v.toLowerCase())) {
      toast.error("That focus area is already in the list");
      return;
    }
    setDraft([...draft, v.slice(0, 100)]);
    setNewCategory("");
  };

  const handleRemove = (idx: number) => {
    setDraft(draft.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await usersApi.updateProfile({ customRecommendationCategories: draft });
      await refreshUser();
      toast.success("Focus areas saved");
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
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cta" />
          <CardTitle>Custom focus areas</CardTitle>
        </div>
        <CardDescription>
          Up to {MAX_CATEGORIES} strategic themes that bias your weekly
          recommendations. Empty = generic recommendations across all
          categories.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {draft.length > 0 && (
          <ul className="space-y-2">
            {draft.map((cat, idx) => (
              <li
                key={`${idx}-${cat}`}
                className="flex items-center justify-between gap-2 rounded-md border border-brand-700/60 bg-brand-950/30 px-3 py-2"
              >
                <span className="text-sm">{cat}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="rounded p-1 text-muted-foreground hover:bg-brand-800 hover:text-foreground"
                  aria-label="Remove focus area"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {draft.length < MAX_CATEGORIES && (
          <div className="flex items-stretch gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="e.g. enterprise GTM, channel partnerships, AI features"
              maxLength={100}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAdd}
              disabled={!newCategory.trim()}
            >
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={!dirty || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save focus areas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
