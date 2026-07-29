"use client";

import { SpinnerIcon, UploadSimpleIcon } from "@phosphor-icons/react";

import { type DetectedFormat, formatDisplayName } from "~/lib/import/detect";

interface UploadStepProps {
  file: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  detectedFormat: DetectedFormat | null;
  isParsing: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UploadStep({
  file,
  fileInputRef,
  detectedFormat,
  isParsing,
  onFileChange,
}: UploadStepProps) {
  return (
    <div className="flex flex-col gap-4 py-4">
      <label className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors w-full block">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,.html,.htm"
          className="hidden"
          onChange={onFileChange}
        />
        {isParsing ? (
          <SpinnerIcon className="size-8 mx-auto mb-2 text-muted-foreground animate-spin" />
        ) : (
          <UploadSimpleIcon className="size-8 mx-auto mb-2 text-muted-foreground" />
        )}
        <p className="text-sm text-muted-foreground">
          {isParsing
            ? "Parsing file…"
            : file
              ? file.name
              : "Click to upload JSON, CSV, or browser bookmarks (.html)"}
        </p>
        {detectedFormat && !isParsing && (
          <p className="text-xs text-muted-foreground/70 mt-1">
            Detected: {formatDisplayName(detectedFormat)}
          </p>
        )}
      </label>
    </div>
  );
}
