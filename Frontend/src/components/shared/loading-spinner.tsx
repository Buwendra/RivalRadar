import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  return <Loader2 className={cn("animate-spin text-muted-foreground", sizeMap[size], className)} />;
}

export function FullPageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-brand-950">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" className="text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
