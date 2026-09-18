"use client";

import { CheckCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";

import type { ImportResult } from "~/hooks/use-import-dialog";

interface DoneStepProps {
  result: ImportResult;
}

export function DoneStep({ result }: DoneStepProps) {
  const hasWorkspace =
    result.workspaceId !== null && result.workspaceId !== undefined;
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircleIcon className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-semibold">Import complete</p>
        <p
          aria-live="polite"
          className="mt-1 text-sm text-muted-foreground tabular-nums"
        >
          {result.imported} imported
          {result.skipped > 0 ? ` · ${result.skipped} skipped` : ""}
        </p>
      </div>
      {hasWorkspace && (
        <Link
          href={`/dashboard?workspaceId=${result.workspaceId}`}
          className="text-sm underline underline-offset-4 hover:text-foreground"
        >
          View imported bookmarks
        </Link>
      )}
    </div>
  );
}
