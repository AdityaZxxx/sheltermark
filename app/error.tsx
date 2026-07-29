"use client";

import { useEffect } from "react";

import { logger } from "~/lib/utils/logger";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error("Next.js route error boundary triggered", {
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }, [error]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred while rendering this page.
        </p>

        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Try again
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
