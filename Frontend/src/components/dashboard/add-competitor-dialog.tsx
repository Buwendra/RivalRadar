"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateCompetitor } from "@/lib/hooks/use-competitors";
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
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PAGE_TYPES } from "@/lib/utils/constants";
import type { PageType } from "@/lib/types";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  url: z.string().url("Please enter a valid URL"),
});

type FormData = z.infer<typeof schema>;

interface AddCompetitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCompetitorDialog({ open, onOpenChange }: AddCompetitorDialogProps) {
  const createCompetitor = useCreateCompetitor();
  const [pagesToTrack, setPagesToTrack] = useState<PageType[]>(["homepage"]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", url: "" },
  });

  const togglePage = (page: PageType) => {
    setPagesToTrack((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  };

  const onSubmit = async (data: FormData) => {
    try {
      await createCompetitor.mutateAsync({
        ...data,
        pagesToTrack,
      });
      toast.success(`${data.name} added successfully`);
      reset();
      setPagesToTrack(["homepage"]);
      onOpenChange(false);
    } catch {
      toast.error("Failed to add competitor. You may have reached your plan limit.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add competitor</DialogTitle>
          <DialogDescription>
            Add a new competitor to monitor. We&apos;ll start tracking changes within 24 hours.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comp-name">Company name</Label>
            <Input id="comp-name" placeholder="Acme Corp" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="comp-url">Website URL</Label>
            <Input id="comp-url" placeholder="https://acme.com" {...register("url")} />
            {errors.url && (
              <p className="text-xs text-destructive">{errors.url.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Pages to track</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAGE_TYPES.map((pt) => (
                <div key={pt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`add-${pt.value}`}
                    checked={pagesToTrack.includes(pt.value as PageType)}
                    onCheckedChange={() => togglePage(pt.value as PageType)}
                  />
                  <Label htmlFor={`add-${pt.value}`} className="text-sm font-normal">
                    {pt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCompetitor.isPending || pagesToTrack.length === 0}>
              {createCompetitor.isPending && <LoadingSpinner size="sm" className="mr-2" />}
              Add Competitor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
