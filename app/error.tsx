"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("ErrorBoundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs text-center">
        <h2 className="text-lg font-semibold">Something went wrong!</h2>
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
  );
}
