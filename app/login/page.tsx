import type { Metadata } from "next";

import { LoginForm } from "~/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login - Sheltermark",
  description: "Sign in to your Sheltermark account to access your bookmarks.",
};

// Next.js hands searchParams over as string | string[] | undefined. Normalize
// to the single-value contract this page consumes (first value wins).
function firstQueryParam(
  raw: string | string[] | undefined,
): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const next = firstQueryParam(params.next);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs">
        <LoginForm next={next} />
      </div>
    </div>
  );
}
