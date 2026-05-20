"use client";

/**
 * Phase 23 — Brand Pulse. Setup dialog for legacy users who onboarded before
 * the self-brand row was created at onboarding. Captures name + website +
 * (optional) industry, calls POST /brand/setup, and the first research run
 * kicks off automatically server-side.
 */

import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useBrandSetup } from "@/lib/hooks/use-brand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ApiClientError } from "@/lib/api/client";

const schema = z.object({
  companyName: z.string().min(1, "Company name is required").max(100),
  companyWebsite: z.string().url("Please enter a valid URL"),
  industry: z.string().max(100).optional(),
});

type FormData = z.infer<typeof schema>;

interface BrandSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompanyName?: string;
  defaultIndustry?: string;
}

export function BrandSetupDialog({
  open,
  onOpenChange,
  defaultCompanyName,
  defaultIndustry,
}: BrandSetupDialogProps) {
  const setup = useBrandSetup();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: defaultCompanyName ?? "",
      companyWebsite: "",
      industry: defaultIndustry ?? "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await setup.mutateAsync({
        companyName: data.companyName.trim(),
        companyWebsite: data.companyWebsite.trim(),
        ...(data.industry ? { industry: data.industry } : {}),
      });
      toast.success("Brand monitoring is on. First research run started.");
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong setting up your brand.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tell us about your brand</DialogTitle>
          <DialogDescription>
            We&apos;ll monitor how the market is talking about you using the same deep-research
            engine that watches your competitors. The first research run starts immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input id="companyName" placeholder="Acme Inc." {...register("companyName")} />
            {errors.companyName && (
              <p className="text-xs text-red-400">{errors.companyName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyWebsite">Company website</Label>
            <Input
              id="companyWebsite"
              type="url"
              placeholder="https://acme.com"
              {...register("companyWebsite")}
            />
            {errors.companyWebsite && (
              <p className="text-xs text-red-400">{errors.companyWebsite.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry (optional)</Label>
            <Input
              id="industry"
              placeholder="SaaS, Fintech, ..."
              {...register("industry")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-cta text-brand-950 hover:bg-cta-hover">
              {submitting && <LoadingSpinner size="sm" className="mr-2" />}
              Start monitoring
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
