"use client";

import { useState } from "react";
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
import { CheckCircle2 } from "lucide-react";

const signUpSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    legalAccepted: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.legalAccepted === true, {
    message: "You must agree to the Terms and Privacy Policy to continue.",
    path: ["legalAccepted"],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const { signUp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", legalAccepted: false },
  });

  const onSubmit = async (data: SignUpFormData) => {
    setError(null);
    try {
      await signUp(data.email, data.password, data.name);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "USER_EXISTS") {
          setError("An account with this email already exists.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    }
  };

  if (success) {
    return (
      <Card className="border-brand-700 bg-brand-900">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <CheckCircle2 className="h-12 w-12 text-significance-low" />
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="text-center text-sm text-muted-foreground">
            We sent a verification link to your email address.
            Please verify your email to continue.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/sign-in">Go to Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          Start monitoring your competitors in minutes.
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
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              placeholder="Jane Smith"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@company.com"
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
              placeholder="At least 8 characters"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          <div className="space-y-2 pt-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-brand-700 bg-brand-800 text-primary focus:ring-2 focus:ring-primary"
                {...register("legalAccepted")}
              />
              <span className="leading-snug text-muted-foreground">
                I agree to the{" "}
                <Link href="/legal/terms" target="_blank" className="text-primary hover:underline">
                  Terms of Service
                </Link>
                ,{" "}
                <Link href="/legal/privacy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                , and{" "}
                <Link href="/legal/aup" target="_blank" className="text-primary hover:underline">
                  Acceptable Use Policy
                </Link>
                .
              </span>
            </label>
            {errors.legalAccepted && (
              <p className="text-xs text-destructive">
                {errors.legalAccepted.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full bg-cta text-brand-950 hover:bg-cta-hover" disabled={isSubmitting}>
            {isSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
            Create account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
