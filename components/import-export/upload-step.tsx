"use client";

import {
  ArrowClockwiseIcon,
  FileArrowUpIcon,
  SpinnerIcon,
  UploadSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { FieldError } from "~/components/ui/field";
import { formatDisplayName, type DetectedFormat } from "~/lib/import/detect";
import { cn } from "~/lib/utils";

interface UploadStepProps {
  file: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  detectedFormat: DetectedFormat | null;
  isParsing: boolean;
  error: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileSelect: (file: File | null | undefined) => void;
  onClearFile: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadStep({
  file,
  fileInputRef,
  detectedFormat,
  isParsing,
  error,
  onFileChange,
  onFileSelect,
  onClearFile,
}: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);

  if (file) {
    return (
      <div className="flex flex-col gap-3 py-2">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {isParsing ? (
              <SpinnerIcon
                className="size-5 motion-safe:animate-spin"
                aria-hidden="true"
              />
            ) : (
              <FileArrowUpIcon className="size-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatBytes(file.size)}
              {detectedFormat && detectedFormat !== "unknown"
                ? ` · ${formatDisplayName(detectedFormat)}`
                : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            aria-label="Replace file"
          >
            <ArrowClockwiseIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClearFile}
            disabled={isParsing}
            aria-label="Remove file"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,.html,.htm"
          className="hidden"
          onChange={onFileChange}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!isParsing) onFileSelect(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "rounded-lg",
          isDragging && "bg-primary/5",
          isParsing && "pointer-events-none opacity-70",
        )}
      >
        <label
          className={cn(
            "flex w-full cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/30",
            isDragging
              ? "border-primary/70"
              : "border-border hover:border-primary/50 hover:bg-muted/30",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.html,.htm"
            className="sr-only"
            onChange={onFileChange}
            disabled={isParsing}
          />
          {isParsing ? (
            <SpinnerIcon
              className="mb-2 size-8 text-muted-foreground motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            <UploadSimpleIcon
              className="mb-2 size-8 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span className="text-sm font-medium">
            {isParsing
              ? "Parsing file…"
              : isDragging
                ? "Drop the file to import"
                : "Drag a file here or click to browse"}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            JSON, CSV, or browser bookmarks (.html) · max 10 MB
          </span>
        </label>
      </div>

      <FieldError errors={error ? [{ message: error }] : undefined} />
    </div>
  );
}
