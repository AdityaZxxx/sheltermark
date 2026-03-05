"use client";

import {
  PencilSimpleIcon,
  SpinnerIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  fullName: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  isUploading?: boolean;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUpload({
  currentAvatarUrl,
  fullName,
  onUpload,
  onRemove,
  isUploading = false,
}: AvatarUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const hasAvatar = Boolean(previewUrl || currentAvatarUrl);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const openFilePicker = () => {
    if (!isUploading && !isRemoving) {
      setError(null);
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Upload JPEG, PNG, or WebP only");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Maximum size is 2MB");
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);

    try {
      await onUpload(file);
    } catch {
      setPreviewUrl(currentAvatarUrl);
      setError("Upload failed. Please try again.");
    }
  };

  const handleRemove = async () => {
    if (isUploading || isRemoving) return;
    setError(null);
    setIsRemoving(true);
    try {
      setPreviewUrl(null);
      await onRemove();
    } finally {
      setIsRemoving(false);
    }
  };

  const isBusy = isUploading || isRemoving;

  return (
    <div className="flex flex-col items-center pt-2 gap-3">
      <Avatar className={`h-24 w-24 ${error ? "ring-2 ring-destructive" : ""}`}>
        <AvatarImage
          src={previewUrl || currentAvatarUrl || undefined}
          alt={fullName}
        />
        <AvatarFallback className="text-2xl bg-muted">
          {fullName?.charAt(0)?.toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={openFilePicker}
          disabled={isBusy}
          aria-label={!hasAvatar ? "Upload avatar" : "Change avatar"}
        >
          {isUploading ? (
            <SpinnerIcon className="h-4 w-4 animate-spin" />
          ) : (
            <PencilSimpleIcon className="h-4 w-4" />
          )}
          <span className="ml-1.5">{!hasAvatar ? "Upload" : "Change"}</span>
        </Button>

        {hasAvatar && (
          <Button
            type="button"
            variant="destructive"
            size="xs"
            onClick={handleRemove}
            disabled={isBusy}
            aria-label="Remove avatar"
          >
            {isRemoving ? (
              <SpinnerIcon className="h-4 w-4 animate-spin" />
            ) : (
              <TrashIcon className="h-4 w-4" />
            )}
            <span className="ml-1.5">Remove</span>
          </Button>
        )}
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </div>
  );
}
