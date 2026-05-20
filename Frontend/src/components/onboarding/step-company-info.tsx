"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDUSTRIES } from "@/lib/utils/constants";

interface StepCompanyInfoProps {
  companyName: string;
  industry: string;
  companyUrl: string;
  onCompanyNameChange: (value: string) => void;
  onIndustryChange: (value: string) => void;
  onCompanyUrlChange: (value: string) => void;
}

export function StepCompanyInfo({
  companyName,
  industry,
  companyUrl,
  onCompanyNameChange,
  onIndustryChange,
  onCompanyUrlChange,
}: StepCompanyInfoProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tell us about your company</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This helps us tailor competitive insights to your market — and lets us monitor how
          the market is talking about you.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company name</Label>
          <Input
            id="companyName"
            placeholder="Acme Inc."
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyWebsite">Company website</Label>
          <Input
            id="companyWebsite"
            type="url"
            placeholder="https://acme.com"
            value={companyUrl}
            onChange={(e) => onCompanyUrlChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used to track how the market is talking about your brand. You can change this later.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Industry</Label>
          <Select value={industry} onValueChange={onIndustryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select your industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((ind) => (
                <SelectItem key={ind} value={ind}>
                  {ind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
