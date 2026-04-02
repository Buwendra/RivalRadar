"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/use-auth";
import { usersApi } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { PLAN_LIMITS } from "@/lib/utils/plan-limits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { StepCompanyInfo } from "@/components/onboarding/step-company-info";
import { StepCompetitors, type CompetitorEntry } from "@/components/onboarding/step-competitors";
import { StepPageTracking } from "@/components/onboarding/step-page-tracking";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import type { PageType } from "@/lib/types";

const STEPS = ["Company", "Competitors", "Pages"];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([
    { name: "", url: "" },
  ]);
  const [pagesToTrack, setPagesToTrack] = useState<PageType[][]>([["homepage"]]);

  const maxCompetitors = PLAN_LIMITS[user?.plan ?? "scout"].maxCompetitors;

  const handleAddCompetitor = () => {
    setCompetitors([...competitors, { name: "", url: "" }]);
    setPagesToTrack([...pagesToTrack, ["homepage"]]);
  };

  const handleRemoveCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
    setPagesToTrack(pagesToTrack.filter((_, i) => i !== index));
  };

  const handleUpdateCompetitor = (index: number, field: "name" | "url", value: string) => {
    const updated = [...competitors];
    updated[index] = { ...updated[index], [field]: value };
    setCompetitors(updated);
  };

  const handleTogglePage = (compIdx: number, page: PageType) => {
    const updated = [...pagesToTrack];
    const current = updated[compIdx];
    if (current.includes(page)) {
      updated[compIdx] = current.filter((p) => p !== page);
    } else {
      updated[compIdx] = [...current, page];
    }
    setPagesToTrack(updated);
  };

  const canProceed = () => {
    if (currentStep === 0) {
      return companyName.trim().length > 0 && industry.length > 0;
    }
    if (currentStep === 1) {
      return competitors.every((c) => c.name.trim() && c.url.trim());
    }
    if (currentStep === 2) {
      return pagesToTrack.every((pages) => pages.length > 0);
    }
    return false;
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await usersApi.onboard({
        companyName: companyName.trim(),
        industry,
        competitors: competitors.map((c, i) => ({
          name: c.name.trim(),
          url: c.url.trim(),
          pagesToTrack: pagesToTrack[i],
        })),
      });
      await refreshUser();
      toast.success("Setup complete! Your competitors are being scanned.");
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const competitorsWithPages = competitors.map((c, i) => ({
    ...c,
    pagesToTrack: pagesToTrack[i] ?? ["homepage"],
  }));

  return (
    <div className="space-y-8">
      <OnboardingProgress currentStep={currentStep} steps={STEPS} />

      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="p-6">
          {currentStep === 0 && (
            <StepCompanyInfo
              companyName={companyName}
              industry={industry}
              onCompanyNameChange={setCompanyName}
              onIndustryChange={setIndustry}
            />
          )}
          {currentStep === 1 && (
            <StepCompetitors
              competitors={competitors}
              maxCompetitors={maxCompetitors}
              onAdd={handleAddCompetitor}
              onRemove={handleRemoveCompetitor}
              onUpdate={handleUpdateCompetitor}
            />
          )}
          {currentStep === 2 && (
            <StepPageTracking
              competitors={competitorsWithPages}
              onTogglePage={handleTogglePage}
            />
          )}

          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              Back
            </Button>

            {currentStep < STEPS.length - 1 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="bg-cta text-brand-950 hover:bg-cta-hover"
              >
                {isSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
                Start Monitoring
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
