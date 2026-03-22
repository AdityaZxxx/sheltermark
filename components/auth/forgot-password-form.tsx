"use client";

import { EnvelopeIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { resetPasswordForEmail } from "~/app/action/reset-password.action";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Button } from "../ui/button";
import { AuthError } from "./auth-error";

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const formData = new FormData(e.currentTarget);
        const result = await resetPasswordForEmail(formData);

        if (!result.success) {
          setError(result.error);
        } else {
          setSuccess(true);
        }
      } catch {
        setError("An unexpected error occurred. Please try again.");
      }
    });
  };

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent you a link to reset your password.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/login">
            <Button className="w-full">Back to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Accessibility: associate error region with email input when present
  const forgotErrorId = error ? "forgot-password-error" : undefined;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Reset Password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      {error && <AuthError error={error} id={forgotErrorId} />}

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <div className="relative">
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="hello@awesome.com"
                required
                aria-invalid={!!error}
                aria-describedby={error ? forgotErrorId : undefined}
                className="pl-10"
              />
              <EnvelopeIcon
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </Field>
          <Field>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Sending..." : "Send Reset Link"}
            </Button>
            <FieldDescription className="text-center">
              Remember your password?{" "}
              <Link
                href="/login"
                className="underline underline-offset-4 hover:text-primary"
              >
                Back to login
              </Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
