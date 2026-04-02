import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Target, Zap } from "lucide-react";
import { ChangeTypeBadge } from "./change-type-badge";
import { SignificanceBadge } from "./significance-badge";
import type { AiAnalysis } from "@/lib/types";

interface AiAnalysisPanelProps {
  analysis: AiAnalysis;
}

export function AiAnalysisPanel({ analysis }: AiAnalysisPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ChangeTypeBadge type={analysis.changeType} />
        <SignificanceBadge score={analysis.significanceScore} />
      </div>

      <Card className="border-brand-700 bg-brand-800">
        <CardContent className="p-4">
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
        </CardContent>
      </Card>

      <Card className="border-brand-700 bg-brand-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-primary" />
            Strategic Implication
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.strategicImplication}
          </p>
        </CardContent>
      </Card>

      <Card className="border-cta/20 bg-cta/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-cta" />
            Recommended Action
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.recommendedAction}
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="h-3 w-3" />
        <span>Analysis powered by Claude AI</span>
      </div>
    </div>
  );
}
