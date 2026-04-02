"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-950 p-8 text-center">
      <Logo className="mb-8" />
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="mt-4 text-xl font-semibold">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. Please try again or contact support if the
        problem persists.
      </p>
      <div className="mt-8 flex gap-4">
        <Button onClick={reset}>Try Again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
