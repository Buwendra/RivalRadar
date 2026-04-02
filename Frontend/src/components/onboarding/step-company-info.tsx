"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDUSTRIES } from "@/lib/utils/constants";

interface StepCompanyInfoProps {
  companyName: string;
  industry: string;
  onCompanyNameChange: (value: string) => void;
  onIndustryChange: (value: string) => void;
}

export function StepCompanyInfo({
  companyName,
  industry,
  onCompanyNameChange,
  onIndustryChange,
}: StepCompanyInfoProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tell us about your company</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This helps us tailor competitive insights to your market.
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
