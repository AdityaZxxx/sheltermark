"use client";

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { updatePassword } from "~/app/action/reset-password.action";
import { Button } from "~/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { AuthError } from "./auth-error";

export function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const formData = new FormData(e.currentTarget);
        const result = await updatePassword(formData);

        if (!result.success) {
          setError(result.error);
        }
      } catch {
        setError("An unexpected error occurred. Please try again.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Create New Password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your new password below.
        </p>
      </div>

      {error && <AuthError error={error} />}

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">New Password</FieldLabel>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeSlashIcon className="size-4" weight="bold" />
                ) : (
                  <EyeIcon className="size-4" weight="bold" />
                )}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </button>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeSlashIcon className="size-4" weight="bold" />
                ) : (
                  <EyeIcon className="size-4" weight="bold" />
                )}
                <span className="sr-only">
                  {showConfirmPassword ? "Hide password" : "Show password"}
                </span>
              </button>
            </div>
          </Field>
          <Field>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Resetting..." : "Reset Password"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              <Link
                href="/login"
                className="underline underline-offset-4 hover:text-primary"
              >
                Back to login
              </Link>
            </p>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
