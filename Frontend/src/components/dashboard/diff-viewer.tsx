import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface DiffViewerProps {
  diffSummary: string;
}

export function DiffViewer({ diffSummary }: DiffViewerProps) {
  const lines = diffSummary.split("\n");

  return (
    <Card className="border-brand-700 bg-brand-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4" />
          Raw Changes
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <pre className="overflow-x-auto rounded-md bg-brand-950 p-4 text-xs leading-relaxed">
          {lines.map((line, i) => {
            let className = "text-muted-foreground";
            if (line.startsWith("+")) className = "text-significance-low";
            else if (line.startsWith("-")) className = "text-significance-high";
            else if (line.startsWith("@@")) className = "text-primary";

            return (
              <div key={i} className={className}>
                {line}
              </div>
            );
          })}
        </pre>
      </CardContent>
    </Card>
  );
}
