"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface MatrixFaviconLoaderProps {
  size?: number;
  className?: string;
}

export function MatrixFaviconLoader({
  size = 16,
  className,
}: MatrixFaviconLoaderProps) {
  return (
    <div
      className={cn("grid grid-cols-3 gap-[2px]", className)}
      style={{ width: size, height: size }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: allowed
          key={`dot-${i}`}
          className="block rounded-full bg-muted-foreground/40 matrix-dot-pulse"
          style={{
            animationDelay: `${(i % 3) * 120 + Math.floor(i / 3) * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

const GLYPHS = "!@#$%^&*()_+{}|:\"<>?,./;'[]\\-=";

interface TextDecryptProps {
  text: string;
  className?: string;
  delay?: number;
  onComplete?: () => void;
}

export function TextDecrypt({
  text,
  className,
  delay = 500,
  onComplete,
}: TextDecryptProps) {
  const [display, setDisplay] = useState(text);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!text) return;

    // Phase 1: Show raw text
    setDisplay(text);

    const startTimeout = setTimeout(() => {
      // Phase 2: Decrypt
      const chars = text.split("");
      const revealed = new Array(chars.length).fill(false);
      let frame = 0;

      const interval = setInterval(() => {
        setDisplay(
          chars
            .map((char, i) => {
              if (revealed[i]) return char;
              if (char === " ") return " ";
              if (frame > i * 2 && Math.random() > 0.4) {
                revealed[i] = true;
                return char;
              }
              return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            })
            .join(""),
        );

        frame++;

        if (revealed.every((r, i) => r || chars[i] === " ")) {
          clearInterval(interval);
          setDisplay(text);
          onCompleteRef.current?.();
        }
      }, 40);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, delay]);

  return <span className={className}>{display}</span>;
}
