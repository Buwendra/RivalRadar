"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Competitor } from "@/lib/types";

interface ChangeFiltersProps {
  competitors: Competitor[];
  selectedCompetitorId: string | undefined;
  selectedSignificance: string | undefined;
  onCompetitorChange: (value: string | undefined) => void;
  onSignificanceChange: (value: string | undefined) => void;
}

export function ChangeFilters({
  competitors,
  selectedCompetitorId,
  selectedSignificance,
  onCompetitorChange,
  onSignificanceChange,
}: ChangeFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={selectedCompetitorId ?? "all"}
        onValueChange={(v) => onCompetitorChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All competitors" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All competitors</SelectItem>
          {competitors.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedSignificance ?? "all"}
        onValueChange={(v) => onSignificanceChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All significance" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All significance</SelectItem>
          <SelectItem value="7">High (7+)</SelectItem>
          <SelectItem value="4">Medium+ (4+)</SelectItem>
          <SelectItem value="1">All (1+)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
