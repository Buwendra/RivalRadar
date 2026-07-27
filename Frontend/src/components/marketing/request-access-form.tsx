"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Dateline } from "@/components/marketing/editorial";

const ACCESS_INBOX = "support@kironyx.com";

const schema = z.object({
  name: z.string().min(1, "Your name helps us reply properly"),
  email: z.string().email("Enter a valid work email"),
  company: z.string().min(1, "Which company are we benchmarking?"),
  note: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof schema>;

/**
 * Request Access — the single lead path while signup is invite-only. Collects
 * the details we need to seed a workspace, then hands off to the visitor's
 * mail client with everything pre-filled (no backend endpoint required yet;
 * wiring this to a stored lead capture is a small follow-up). The direct inbox
 * is always shown as a fallback so a blocked mail client is never a dead end.
 */
export function RequestAccessForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", company: "", note: "" },
  });

  const onSubmit = (data: FormData) => {
    const subject = `Access request — ${data.company}`;
    const body = [
      `Name: ${data.name}`,
      `Work email: ${data.email}`,
      `Company: ${data.company}`,
      "",
      data.note?.trim()
        ? `What they're hoping to get out of Kironyx:\n${data.note.trim()}`
        : "(no note)",
    ].join("\n");
    window.location.href = `mailto:${ACCESS_INBOX}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  if (sent) {
    const email = getValues("email");
    return (
      <div className="rounded-lg border border-ink/12 bg-obsidian-900/60 p-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/20">
          <Check className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <Dateline className="mt-6">Request filed</Dateline>
        <h3 className="mt-4 font-display text-headline text-foreground">
          Your email client is open with the details.
        </h3>
        <p className="mt-3 text-body-lg text-muted-foreground measure">
          Send it and we&apos;ll reply within one business day
          {email ? ` to ${email}` : ""}. Prefer to write directly? Reach us at{" "}
          <a
            href={`mailto:${ACCESS_INBOX}`}
            className="text-foreground underline underline-offset-2 hover:text-foreground/80"
          >
            {ACCESS_INBOX}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-lg border border-ink/12 bg-obsidian-900/40 p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="ra-name"
          label="Name"
          error={errors.name?.message}
          input={
            <Input id="ra-name" placeholder="Jordan Avery" {...register("name")} />
          }
        />
        <Field
          id="ra-company"
          label="Company"
          error={errors.company?.message}
          input={
            <Input
              id="ra-company"
              placeholder="Northwind Labs"
              {...register("company")}
            />
          }
        />
      </div>
      <div className="mt-5">
        <Field
          id="ra-email"
          label="Work email"
          error={errors.email?.message}
          input={
            <Input
              id="ra-email"
              type="email"
              placeholder="jordan@northwind.com"
              {...register("email")}
            />
          }
        />
      </div>
      <div className="mt-5">
        <Field
          id="ra-note"
          label="What are you trying to see? (optional)"
          error={errors.note?.message}
          input={
            <Textarea
              id="ra-note"
              rows={3}
              placeholder="Who you're up against, and what a good week of intelligence would tell you."
              {...register("note")}
            />
          }
        />
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs text-muted-foreground">
          Invite-only while we onboard new workspaces.
        </p>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="group bg-cta text-obsidian-950 transition-[transform,background-color] duration-150 ease-out-strong hover:bg-cta-hover active:scale-[0.97]"
        >
          {isSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
          Request access
          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-150 ease-out-strong group-hover:translate-x-0.5" />
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  input,
}: {
  id: string;
  label: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="font-mono text-label uppercase text-muted-foreground"
      >
        {label}
      </Label>
      {input}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
