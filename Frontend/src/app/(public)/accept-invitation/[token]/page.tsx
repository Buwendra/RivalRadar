"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";
import { workspacesApi } from "@/lib/api/workspaces";
import { ApiClientError } from "@/lib/api/client";
import { CURRENT_WORKSPACE_STORAGE_KEY } from "@/lib/hooks/use-workspaces";
import type { AcceptInvitationResponse } from "@/lib/types";

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<
    | { status: "pending" }
    | { status: "success"; data: AcceptInvitationResponse }
    | { status: "error"; message: string }
  >({ status: "pending" });

  // Guard against React Strict Mode double-invocation in dev.
  const requestedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace(
        `/sign-in?redirect=${encodeURIComponent(`/accept-invitation/${token}`)}`
      );
      return;
    }
    if (requestedRef.current) return;
    requestedRef.current = true;

    void (async () => {
      try {
        const result = await workspacesApi.acceptInvitation(token);
        localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, result.workspaceId);
        qc.invalidateQueries();
        setState({ status: "success", data: result });
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : "Something went wrong accepting this invitation.";
        setState({ status: "error", message });
      }
    })();
  }, [authLoading, isAuthenticated, qc, router, token]);

  if (authLoading || state.status === "pending") {
    return (
      <div className="mx-auto max-w-md py-16">
        <Card className="border-brand-700 bg-brand-900">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Accepting invitation…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="mx-auto max-w-md py-16">
        <Card className="border-brand-700 bg-brand-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Welcome to {state.data.workspaceName}
            </CardTitle>
            <CardDescription>
              You&apos;re in. The workspace&apos;s competitors and weekly
              briefings are now visible from your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <Card className="border-brand-700 bg-brand-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Couldn&apos;t accept invitation
          </CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
