import type React from "react";

import { MagnifyingGlassIcon, PlusIcon, Robot } from "@phosphor-icons/react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Input } from "~/components/ui/input";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { cn, isUrlLike } from "~/lib/utils";

import { Orb } from "./orb";

const isMac =
  "navigator" in globalThis && /Mac|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? "⌘" : "Ctrl";

const PLACEHOLDER_HINTS = [
  "Search bookmarks...",
  "Paste a URL to save it...",
  "Search your tags...",
  "Search your notes...",
];
const HINT_INTERVAL_MS = 3500;

function subscribeMotionPref(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

interface BookmarkInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onAskAi?: () => void;
  isAskingAi?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  ref?: React.Ref<HTMLInputElement>;
}

export function BookmarkInput({
  value,
  onChange,
  onSubmit,
  onAskAi,
  isAskingAi = false,
  onKeyDown,
  ref,
}: BookmarkInputProps) {
  const isAdding = isUrlLike(value);
  const [isFocused, setIsFocused] = useState(false);
  const showAskAi = Boolean(onAskAi) && !isAdding && value.trim().length > 0;

  // Rotating placeholder: cycles hints while idle; pauses on focus or any
  // typed input. Reduced-motion users get an opacity-only crossfade
  // (gentler, not zero) tracked live via matchMedia.
  const [hintIndex, setHintIndex] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeMotionPref,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const paused = isFocused || value.length > 0;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(
      () => setHintIndex((i) => (i + 1) % PLACEHOLDER_HINTS.length),
      HINT_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Dialogs own the keyboard while open.
      if (document.querySelector("[role='dialog']")) return;
      const input = ref && "current" in ref ? ref.current : null;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (input && document.activeElement === input) {
          return;
        }
        e.preventDefault();
        input?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [ref]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && showAskAi) {
      e.preventDefault();
      e.stopPropagation();
      if (!isAskingAi) onAskAi?.();
      return;
    }
    if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      e.stopPropagation();
      onSubmit(value.trim());
      if (isUrlLike(value)) {
        onChange("");
      }
      return;
    }
    if (e.key === "Escape") {
      if (ref && "current" in ref && ref.current) {
        ref.current.blur();
      }
    }
    onKeyDown?.(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (pastedText.includes("\n")) {
      e.preventDefault();
      onSubmit(pastedText);
    }
  };

  return (
    <div className="relative group">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
        {isAdding ? (
          <PlusIcon className="h-4 w-4" weight="bold" />
        ) : (
          <MagnifyingGlassIcon className="h-4 w-4" weight="bold" />
        )}
      </div>
      <Input
        ref={ref}
        aria-label="Search or paste URL to add"
        className={`pl-10 h-11 rounded-xl ${showAskAi ? "pr-24" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Outer spans center statically; inner spans carry the animation,
            so translateY never fights the centering transform. */}
        {PLACEHOLDER_HINTS.map((hint, i) => (
          <span key={hint} className="absolute inset-y-0 left-10 flex">
            <span
              className={cn(
                "flex items-center whitespace-nowrap text-sm text-muted-foreground transition-[opacity,translate] duration-300 ease-out",
                // Hidden while typing; frozen on the current hint when
                // merely focused (matches native placeholder behavior).
                i === hintIndex && value.length === 0
                  ? cn("opacity-100", !reducedMotion && "translate-y-0")
                  : cn("opacity-0", !reducedMotion && "-translate-y-1"),
              )}
            >
              {hint}
            </span>
          </span>
        ))}
      </div>
      {showAskAi && onAskAi && (
        <button
          type="button"
          onClick={onAskAi}
          disabled={isAskingAi}
          aria-label="Search with AI"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-7 items-center gap-1 rounded-lg border bg-background px-2 text-xs font-medium text-muted-foreground transition-[color,background-color,border-color,scale] duration-150 ease-out hover:border-border hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isAskingAi ? (
            <>
              <span aria-hidden="true" className="inline-flex">
                <Orb size={16} />
              </span>
              <span className="shimmer">Asking...</span>
            </>
          ) : (
            <>
              <Robot className="size-3.5" aria-hidden="true" />
              Ask AI
            </>
          )}
        </button>
      )}
      {!showAskAi && (
        <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 pointer-events-none md:block">
          {!isFocused && (
            <KbdGroup>
              <Kbd>{mod}</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          )}
        </div>
      )}
    </div>
  );
}
