"use client";

import { TagIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

import type { TagWithCount } from "~/lib/schemas/tag.schema";
import type { TagEntry } from "~/lib/utils";

import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";

interface TagInputProps {
  value: TagEntry[];
  onChange: (next: TagEntry[]) => void;
  allUserTags: TagWithCount[];
}

export function TagInput({ value, onChange, allUserTags }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const q = inputValue.trim().toLowerCase();
  const usedIds = new Set(value.map((e) => e.id).filter(Boolean));
  const usedNames = new Set(value.map((e) => e.name.toLowerCase()));

  const suggestions = allUserTags
    .filter((t) => {
      if (usedIds.has(t.id)) return false;
      if (usedNames.has(t.name.toLowerCase())) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q);
    })
    .slice(0, 8);

  const trimmedInput = inputValue.trim();
  const canCreateNew =
    trimmedInput.length > 0 &&
    !value.some((e) => e.name.toLowerCase() === trimmedInput.toLowerCase());

  const commitInput = () => {
    if (!trimmedInput) return;
    onChange([...value, { name: trimmedInput }]);
    setInputValue("");
  };

  const removeEntry = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addSuggestion = (tag: TagWithCount) => {
    onChange([...value, { id: tag.id, name: tag.name }]);
    setInputValue("");
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="edit-tag-input" className="text-xs">
        Tags
      </Label>

      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-input/20 px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
        {value.map((entry, index) => (
          <Badge
            key={entry.id ?? `new-${index}-${entry.name}`}
            variant="secondary"
            className="h-6 gap-1 px-2"
          >
            <TagIcon className="size-2.5!" aria-hidden="true" />
            {entry.name}
            <button
              type="button"
              onClick={() => removeEntry(index)}
              aria-label={`Remove tag ${entry.name}`}
              className="-mr-1 ml-0.5 inline-flex size-4 items-center justify-center rounded-sm opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          id="edit-tag-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitInput();
            } else if (
              e.key === "Backspace" &&
              !inputValue &&
              value.length > 0
            ) {
              e.preventDefault();
              removeEntry(value.length - 1);
            }
          }}
          placeholder={value.length === 0 ? "Add a tag..." : "Add another..."}
          className="min-w-[8ch] flex-1 bg-transparent text-xs/relaxed outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      {trimmedInput && (suggestions.length > 0 || canCreateNew) && (
        <div className="rounded-md border border-border/60 bg-popover shadow-sm">
          {canCreateNew && (
            <button
              type="button"
              onClick={commitInput}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs/relaxed transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span className="text-muted-foreground">Create</span>
              <span className="font-medium">{trimmedInput}</span>
            </button>
          )}
          {canCreateNew && suggestions.length > 0 && (
            <div className="mx-2 h-px bg-border/60" />
          )}
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => addSuggestion(tag)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs/relaxed transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span className="flex items-center gap-2">
                <TagIcon
                  className="size-3 text-muted-foreground"
                  aria-hidden="true"
                />
                {tag.name}
              </span>
              <span className="text-muted-foreground/60">{tag.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
