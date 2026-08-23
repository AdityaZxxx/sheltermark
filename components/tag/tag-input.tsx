"use client";

import { BookmarkIcon, TagIcon, XIcon } from "@phosphor-icons/react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { TagWithCount } from "~/lib/schemas/tag.schema";
import type { TagEntry } from "~/lib/utils";

import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import { formatCount } from "~/lib/utils";
import { filterTagSuggestions, tagKeyAction } from "~/lib/utils/tag-entries";

interface TagInputProps {
  value: TagEntry[];
  onChange: (next: TagEntry[]) => void;
  allUserTags: TagWithCount[];
}

const MAX_SUGGESTIONS = 8;

export function TagInput({ value, onChange, allUserTags }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const fieldRef = useRef<HTMLDivElement>(null);

  const suggestions = filterTagSuggestions(
    allUserTags,
    value,
    inputValue,
  ).slice(0, MAX_SUGGESTIONS);

  const trimmedInput = inputValue.trim();
  const canCreateNew =
    trimmedInput.length > 0 &&
    !value.some((e) => e.name.toLowerCase() === trimmedInput.toLowerCase());

  // Escape dismisses the panel while preserving typed text; typing reopens it.
  const showPanel =
    isOpen && Boolean(trimmedInput) && (canCreateNew || suggestions.length > 0);
  const createOffset = canCreateNew ? 1 : 0;
  const optionCount = suggestions.length + createOffset;
  const optionId = (index: number) => `${listId}-${index}`;

  // Portal the panel to <body> as position:fixed so it escapes the edit
  // dialog's overflow-y-auto body (it was being clipped under the sticky
  // footer). Measured against the field; re-measured on resize/scroll.
  const [anchor, setAnchor] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!showPanel || !fieldRef.current) {
      setAnchor(null);
      return;
    }
    const update = () => {
      const rect = fieldRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
        maxHeight: Math.min(256, window.innerHeight - rect.bottom - 12),
      });
    };
    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [showPanel]);

  const commitInput = () => {
    if (!trimmedInput) return;
    onChange([...value, { name: trimmedInput }]);
    setInputValue("");
    setActiveIndex(-1);
    setIsOpen(false);
  };

  const removeEntry = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addSuggestion = (tag: TagWithCount | undefined) => {
    if (!tag) return;
    onChange([...value, { id: tag.id, name: tag.name }]);
    setInputValue("");
    setActiveIndex(-1);
    setIsOpen(false);
  };

  // Enter with nothing highlighted commits the typed text.
  const activateOption = (index: number) => {
    if (index < 0 || (canCreateNew && index === 0)) {
      commitInput();
      return;
    }
    addSuggestion(suggestions[index - createOffset]);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="edit-tag-input" className="text-xs">
        Tags
      </Label>

      <div
        ref={fieldRef}
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border/70 bg-card px-2 py-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/10"
      >
        {value.map((entry, index) => (
          <Badge
            key={entry.id ?? `new-${index}-${entry.name}`}
            variant="secondary"
            className="h-6 gap-1 px-2"
          >
            {entry.name}
            <button
              type="button"
              onClick={() => removeEntry(index)}
              aria-label={`Remove tag ${entry.name}`}
              className="-mr-1 ml-0.5 inline-flex size-4 items-center justify-center rounded-sm opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:opacity-100 focus-visible:bg-muted"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          id="edit-tag-input"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={showPanel ? listId : undefined}
          aria-activedescendant={
            activeIndex >= 0 && showPanel ? optionId(activeIndex) : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !inputValue && value.length > 0) {
              e.preventDefault();
              removeEntry(value.length - 1);
              return;
            }

            // Inner layer consumes Escape first; the dialog only sees it
            // once the suggestion panel has nothing to dismiss.
            if (e.key === "Escape" && showPanel) {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
              setActiveIndex(-1);
              return;
            }

            const action = tagKeyAction(
              e.key,
              activeIndex,
              showPanel ? optionCount : 0,
            );
            if (action === "none") return;
            e.preventDefault();

            if (action === "down")
              setActiveIndex(Math.min(activeIndex + 1, optionCount - 1));
            else if (action === "up")
              setActiveIndex(Math.max(activeIndex - 1, -1));
            else if (action === "activate") activateOption(activeIndex);
            else if (action === "commit" && canCreateNew) commitInput();
          }}
          placeholder={value.length === 0 ? "Add a tag..." : "Add another..."}
          className="min-w-[8ch] flex-1 bg-transparent text-xs/relaxed outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      {showPanel && anchor
        ? createPortal(
            <div
              id={listId}
              role="listbox" // oxlint-disable-line jsx-a11y/prefer-tag-over-role -- free-text combobox; select/datalist cannot render styled options with counts
              aria-label="Tag suggestions"
              style={{
                left: anchor.left,
                top: anchor.top,
                width: anchor.width,
                maxHeight: anchor.maxHeight,
              }}
              className="fixed z-50 overflow-y-auto rounded-md border border-border/60 bg-popover text-popover-foreground shadow-sm"
            >
              {canCreateNew && (
                <button
                  type="button"
                  tabIndex={-1}
                  id={optionId(0)}
                  role="option" // oxlint-disable-line jsx-a11y/prefer-tag-over-role -- see listbox above
                  aria-selected={activeIndex === 0}
                  onClick={commitInput}
                  onMouseEnter={() => setActiveIndex(0)}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs/relaxed transition-colors hover:bg-accent hover:text-accent-foreground ${
                    activeIndex === 0 ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <span className="text-muted-foreground">Create</span>
                  <span className="font-medium">{trimmedInput}</span>
                </button>
              )}
              {canCreateNew && suggestions.length > 0 && (
                <div className="mx-2 h-px bg-border/60" />
              )}
              {suggestions.map((tag, i) => {
                const index = i + createOffset;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    tabIndex={-1}
                    id={optionId(index)}
                    role="option" // oxlint-disable-line jsx-a11y/prefer-tag-over-role -- see listbox above
                    aria-selected={activeIndex === index}
                    onClick={() => addSuggestion(tag)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs/relaxed transition-colors hover:bg-accent hover:text-accent-foreground ${
                      activeIndex === index
                        ? "bg-accent text-accent-foreground"
                        : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <TagIcon
                        className="size-3 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {tag.name}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[0.625rem] font-medium tabular-nums">
                      <BookmarkIcon aria-hidden="true" />
                      <span aria-hidden="true">{tag.count}</span>
                      <span className="sr-only">
                        {formatCount(tag.count, "bookmark")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
