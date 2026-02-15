"use client";

import { CameraIcon, SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Input } from "./ui/input";

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  fullName: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  isUploading?: boolean;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function AvatarUpload({
  currentAvatarUrl,
  fullName,
  onUpload,
  onRemove,
  isUploading = false,
}: AvatarUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset error
    setError(null);

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please upload a valid image file (JPEG, PNG, WebP, or GIF)");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError("File size must be less than 2MB");
      return;
    }

    // Create preview URL
    const objectUrl = URL.createObjectURL(file);

    // Set preview immediately
    setPreviewUrl(objectUrl);

    // Trigger upload
    onUpload(file)
      .then(() => {
        // Keep the preview on success - upload completed
      })
      .catch(() => {
        // Revert preview on error
        setPreviewUrl(currentAvatarUrl);
      });

    // Note: We're not revoking the object URL immediately
    // It will be cleaned up when component unmounts or when new file is selected
  };

  const handleAvatarClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleRemoveClick = async (
    e?: React.MouseEvent | React.KeyboardEvent,
  ) => {
    e?.stopPropagation();
    setPreviewUrl(null);
    await onRemove();
  };

  const hasAvatar = previewUrl || currentAvatarUrl;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Clickable Avatar with Hover Overlay */}
      <button
        type="button"
        className="relative cursor-pointer bg-transparent border-none p-0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleAvatarClick}
        aria-label={hasAvatar ? "Change avatar" : "Upload avatar"}
      >
        <Avatar className="h-24 w-24 transition-opacity duration-200">
          <AvatarImage
            key={previewUrl || currentAvatarUrl || "fallback"}
            src={previewUrl || currentAvatarUrl || undefined}
            alt={fullName}
            className={isHovered && !isUploading ? "opacity-50" : "opacity-100"}
          />
          <AvatarFallback className="text-2xl bg-muted">
            {fullName.charAt(0).toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>

        {/* Hover Overlay */}
        {!isUploading && isHovered && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            {hasAvatar ? (
              <div
                role="button"
                onClick={handleRemoveClick}
                className="p-2 rounded-full bg-background text-destructive hover:bg-back/90 transition-colors cursor-pointer"
                aria-label="Remove avatar"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRemoveClick();
                  }
                }}
              >
                <TrashIcon className="h-5 w-5" weight="bold" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-background/90 text-white">
                <CameraIcon className="h-5 w-5" />
              </div>
            )}
          </div>
        )}

        {/* Loading Overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
            <SpinnerIcon className="h-6 w-6 rounded-full animate-spin" />
          </div>
        )}
      </button>

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <p className="text-xs text-muted-foreground text-center">
        Click avatar to {hasAvatar ? "change" : "upload"} • Max 2MB
      </p>
    </div>
  );
}
