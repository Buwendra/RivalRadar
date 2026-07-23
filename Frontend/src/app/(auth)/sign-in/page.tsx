"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth/use-auth";
import { ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { SIGNUP_ENABLED } from "@/lib/utils/signup-flag";

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type SignInFormData = z.infer<typeof signInSchema>;

/**
 * Only same-origin paths are honoured as post-sign-in destinations. A full
 * URL (`https://evil.example`) or protocol-relative `//evil.example` in
 * `?redirect=` would otherwise let a crafted sign-in link forward a freshly
 * authenticated user to an attacker page.
 */
function safeRedirectPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

function SignInForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirectPath(searchParams.get("redirect"));
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: SignInFormData) => {
    setError(null);
    try {
      await signIn(data.email, data.password);
      router.push(redirect);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "UNCONFIRMED") {
          setError("Please verify your email before signing in.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    }
  };

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>
          Welcome back. Enter your credentials to continue.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
            Sign in
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            {SIGNUP_ENABLED ? (
              <Link href="/sign-up" className="text-primary hover:underline">
                Sign up
              </Link>
            ) : (
              <Link href="/contact" className="text-primary hover:underline">
                Contact us
              </Link>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" className="mx-auto" />}>
      <SignInForm />
    </Suspense>
  );
}
