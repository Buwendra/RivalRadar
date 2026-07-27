import { cn } from "@/lib/utils";

/**
 * Standfirst — the oversized lead paragraph (a "dek" in publishing) that sits
 * under an editorial headline and carries the section's argument in one
 * breath. Measured line length so it stays readable.
 */
export function Standfirst({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-standfirst text-muted-foreground measure",
        className,
      )}
    >
      {children}
    </p>
  );
}
