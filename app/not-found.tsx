"use client";

import { WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs text-center">
        <div className="mb-4 flex justify-center">
          <WarningCircle
            className="h-12 w-12 text-muted-foreground"
            weight="duotone"
          />
        </div>
        <h2 className="text-xl font-semibold">Page Not Found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Go back home
        </Link>
      </div>
    </div>
  );
}
