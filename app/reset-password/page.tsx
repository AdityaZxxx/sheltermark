import { ResetPasswordForm } from "~/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
