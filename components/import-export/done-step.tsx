"use client";

import Link from "next/link";

import type { ImportResult } from "~/hooks/use-import-dialog";

import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface DoneStepProps {
  result: ImportResult;
}

export function DoneStep({ result }: DoneStepProps) {
  const hasWorkspace =
    result.workspaceId !== null && result.workspaceId !== undefined;
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="text-center">
        <p className="text-lg font-medium">Import Complete</p>
        <p className="text-sm text-muted-foreground mt-1">
          {result.imported} imported, {result.skipped} skipped
        </p>
      </div>
      {hasWorkspace && (
        <Link
          href={`/workspace/${result.workspaceId}`}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          View imported bookmarks
        </Link>
      )}
    </div>
  );
}
