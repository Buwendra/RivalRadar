import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div>
        <p className="font-medium text-destructive">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
