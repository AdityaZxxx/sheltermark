import type { Metadata } from "next";
import { SignupForm } from "~/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign Up - Sheltermark",
  description:
    "Create your Sheltermark account to start organizing your bookmarks.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs">
        <SignupForm next={next} />
      </div>
    </div>
  );
}
