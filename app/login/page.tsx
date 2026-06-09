import type { Metadata } from "next";
import { LoginForm } from "~/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login - Sheltermark",
  description: "Sign in to your Sheltermark account to access your bookmarks.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs">
        <LoginForm next={next} />
      </div>
    </div>
  );
}
