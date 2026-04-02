import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <Shield className="h-5 w-5 text-primary-foreground" />
      </div>
      {!iconOnly && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Rival<span className="text-primary">Scan</span>
        </span>
      )}
    </div>
  );
}
