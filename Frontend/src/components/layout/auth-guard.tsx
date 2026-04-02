"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/use-auth";
import { FullPageLoader } from "@/components/shared/loading-spinner";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !user.onboardingComplete) {
      router.push("/onboarding");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated || !user) {
    return <FullPageLoader />;
  }

  if (!user.onboardingComplete) {
    return <FullPageLoader />;
  }

  return <>{children}</>;
}
