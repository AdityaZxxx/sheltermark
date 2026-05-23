"use client";

import { useEffect } from "react";

import { logger } from "~/lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    logger.error("GlobalError caught", { error, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-xs text-center">
            <h2 className="text-lg font-semibold">Something went wrong!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A critical error occurred. Please try refreshing the page.
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-muted-foreground">
                Error ID: {error.digest}
              </p>
            )}
            <button
              type="button"
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={() => reset?.()}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
