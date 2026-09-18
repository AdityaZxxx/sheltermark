import { FileArrowUpIcon, SpinnerIcon } from "@phosphor-icons/react";

interface ImportingStepProps {
  progress: number;
  fileName: string | null;
}

export function ImportingStep({ progress, fileName }: ImportingStepProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)));
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        {clamped >= 100 ? (
          <FileArrowUpIcon className="size-6" aria-hidden="true" />
        ) : (
          <SpinnerIcon
            className="size-6 motion-safe:animate-spin"
            aria-hidden="true"
          />
        )}
      </span>
      <div>
        <p className="text-sm font-medium">Importing bookmarks…</p>
        {fileName && (
          <p
            className="mt-0.5 max-w-64 truncate text-xs text-muted-foreground"
            title={fileName}
          >
            {fileName}
          </p>
        )}
      </div>
      <div className="w-full space-y-1.5">
        <progress
          value={clamped}
          max={100}
          aria-label="Import progress"
          className="h-2 w-full overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
        />
        <p className="text-xs text-muted-foreground tabular-nums">{clamped}%</p>
      </div>
    </div>
  );
}
