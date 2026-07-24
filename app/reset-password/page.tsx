import type { Metadata } from "next";
import { ResetPasswordForm } from "~/components/auth/reset-password-form";
import { requireAuth } from "~/lib/auth";

export const metadata: Metadata = {
  title: "Reset Password - Sheltermark",
  description:
    "Reset your password to regain access to your Sheltermark account.",
};

export default async function ResetPasswordPage() {
  await requireAuth();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
