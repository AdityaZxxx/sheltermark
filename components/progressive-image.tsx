"use client";

import { useState } from "react";
import { cn } from "~/lib/utils";

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  skeletonClassName?: string;
}

export function ProgressiveImage({
  src,
  alt,
  className,
  containerClassName,
  skeletonClassName,
}: ProgressiveImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError) return null;

  return (
    <div className={cn("overflow-hidden relative", containerClassName)}>
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 bg-muted animate-pulse",
            skeletonClassName,
          )}
        />
      )}
      {/* biome-ignore lint/performance/noImgElement: external domain source */}
      <img
        src={src}
        alt={alt}
        className={cn(
          "transition-all duration-300",
          isLoading && "opacity-0 scale-105 blur-sm",
          className,
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
