import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* unoptimized: SVG sources bypass the Next image optimizer (it rejects
          SVG unless dangerouslyAllowSVG is enabled globally) */}
      <Image
        src="/Kironyx_logo.svg"
        alt="Kironyx logo"
        width={32}
        height={32}
        unoptimized
        className="h-8 w-8 rounded-lg"
      />
      {!iconOnly && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Kirony<span className="text-primary">X</span>
        </span>
      )}
    </div>
  );
}
