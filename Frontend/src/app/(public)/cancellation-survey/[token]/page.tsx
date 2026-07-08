"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancellationApi, type CancellationReason } from "@/lib/api/cancellation";
import { ApiClientError } from "@/lib/api/client";

const REASON_OPTIONS: Array<{ value: CancellationReason; label: string; helper?: string }> = [
  { value: "price", label: "Too expensive", helper: "The price didn't feel justified for what I got." },
  { value: "value", label: "Didn't see enough value", helper: "It didn't move my work in a meaningful way." },
  { value: "missing-features", label: "Missing features I needed" },
  { value: "usability", label: "Hard to use / confusing" },
  { value: "switched", label: "Switched to another tool" },
  { value: "no-longer-needed", label: "Don't need competitive intel anymore" },
  { value: "temporary-pause", label: "Just taking a break" },
  { value: "other", label: "Other (tell us below)" },
];

export default function CancellationSurveyPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [freeText, setFreeText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error("Pick a reason first");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await cancellationApi.submit(token, {
        reason,
        ...(freeText.trim() ? { freeText: freeText.trim() } : {}),
      });
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Couldn't save feedback.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="border-brand-700 bg-brand-900">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <h2 className="text-xl font-semibold">Thanks for the feedback</h2>
            <p className="text-center text-sm text-muted-foreground">
              That genuinely helps us improve. If you ever change your mind, you can resubscribe anytime.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/">Back to Kironyx</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-12">
      <Card className="border-brand-700 bg-brand-900">
        <CardHeader>
          <CardTitle>Sorry to see you go</CardTitle>
          <CardDescription>
            30 seconds to tell us why you canceled. No follow-up sales pitch — we just want to do better.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-medium">What made you cancel?</Label>
              <ul className="space-y-1.5">
                {REASON_OPTIONS.map((opt) => (
                  <li key={opt.value}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-brand-700/60 bg-brand-950/30 p-3 transition-colors hover:bg-brand-950/50">
                      <input
                        type="radio"
                        name="reason"
                        value={opt.value}
                        checked={reason === opt.value}
                        onChange={() => setReason(opt.value)}
                        className="mt-0.5 h-4 w-4 cursor-pointer"
                        disabled={isSubmitting}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">{opt.label}</span>
                        {opt.helper && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{opt.helper}</p>
                        )}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="freeText" className="text-xs uppercase tracking-wide text-muted-foreground">
                Anything else? (optional)
              </Label>
              <Textarea
                id="freeText"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="What would have changed your mind?"
                disabled={isSubmitting}
              />
              <p className="text-[10px] text-muted-foreground/70">{freeText.length}/2000</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={!reason || isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send feedback
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
