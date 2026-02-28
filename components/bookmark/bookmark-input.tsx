import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import type React from "react";
import { forwardRef, useEffect } from "react";
import { Input } from "~/components/ui/input";
import { Kbd, KbdGroup } from "~/components/ui/kbd";

interface BookmarkInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const BookmarkInput = forwardRef<HTMLInputElement, BookmarkInputProps>(
  function BookmarkInput({ value, onChange, onSubmit, onKeyDown }, ref) {
    const isAdding = value.includes(".") || value.startsWith("http");

    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          if (ref && "current" in ref && ref.current) {
            ref.current.focus();
          }
        }
      };
      window.addEventListener("keydown", handleGlobalKeyDown);
      return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [ref]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && value.trim()) {
        e.preventDefault();
        e.stopPropagation();
        onSubmit(value.trim());
        onChange("");
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
          placeholder="Search or paste URL to add..."
          className="pl-10 h-11 bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </div>
      </div>
    );
  },
);
