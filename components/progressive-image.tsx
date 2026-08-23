"use client";

import { useLayoutEffect, useRef, useState } from "react";

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
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Cached images are already complete at mount; skip the skeleton/blur
  // phase so remounts (e.g. view switches) don't replay the load animation.
  useLayoutEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setIsLoading(false);
  }, []);

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
      {/* oxlint-disable-next-line next/no-img-element -- dynamic-size external images, next/image is not beneficial */}
      <img
        ref={imgRef}
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
