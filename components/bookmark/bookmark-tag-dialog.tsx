"use client";

import { TagIcon, XIcon } from "@phosphor-icons/react";
import { useForm, useStore } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { useTagMutations } from "~/hooks/use-tag-mutations";
import { useUserTagsWithCount } from "~/hooks/use-user-tags";
import type { Tag, TagWithCount } from "~/lib/schemas/tag.schema";
import { cn } from "~/lib/utils";

interface BookmarkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark: { id: string; title: string; tags: Tag[] } | null;
  onSuccess: () => void;
}

type TagEntry = { id?: string; name: string };

function tagsToEntries(tags: Tag[]): TagEntry[] {
  return tags.map((t) => ({ id: t.id, name: t.name }));
}

function entriesEqual(a: TagEntry[], b: TagEntry[]): boolean {
  if (a.length !== b.length) return false;
  const aKeys = a.map((e) => e.id ?? `name:${e.name.toLowerCase()}`).sort();
  const bKeys = b.map((e) => e.id ?? `name:${e.name.toLowerCase()}`).sort();
  return aKeys.every((k, i) => k === bKeys[i]);
}

export function BookmarkTagDialog({
  open,
  onOpenChange,
  bookmark,
  onSuccess,
}: BookmarkTagDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && bookmark && (
        <TagFormInner
          key={bookmark.id}
          bookmark={bookmark}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  );
}

function TagFormInner({
  bookmark,
  onOpenChange,
  onSuccess,
}: Omit<BookmarkTagDialogProps, "open"> & {
  bookmark: NonNullable<BookmarkTagDialogProps["bookmark"]>;
}) {
  const { tags: allUserTags } = useUserTagsWithCount();
  const { setBookmarkTags, isSettingBookmarkTags } = useTagMutations();

  const initialEntries = useMemo(
    () => tagsToEntries(bookmark.tags),
    [bookmark.tags],
  );

  const form = useForm({
    defaultValues: { entries: initialEntries },
    onSubmit: async ({ value }) => {
      if (entriesEqual(value.entries, initialEntries)) {
        onOpenChange(false);
        return;
      }

      setBookmarkTags(
        {
          bookmarkId: bookmark.id,
          tags: value.entries.map((e) =>
            e.id ? { id: e.id } : { name: e.name },
          ),
        },
        {
          onSuccess: () => {
            onSuccess();
            onOpenChange(false);
          },
        },
      );
    },
  });

  const entries = useStore(form.store, (state) => state.values.entries);
  const [inputValue, setInputValue] = useState("");

  const suggestions = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    const usedIds = new Set(entries.map((e) => e.id).filter(Boolean));
    const usedNames = new Set(entries.map((e) => e.name.toLowerCase()));

    return allUserTags
      .filter((t) => {
        if (usedIds.has(t.id)) return false;
        if (usedNames.has(t.name.toLowerCase())) return false;
        if (!q) return true;
        return t.name.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [allUserTags, entries, inputValue]);

  const trimmedInput = inputValue.trim();
  const canCreateNew =
    trimmedInput.length > 0 &&
    !entries.some((e) => e.name.toLowerCase() === trimmedInput.toLowerCase());

  const commitInput = () => {
    if (!trimmedInput) return;
    form.setFieldValue("entries", [...entries, { name: trimmedInput }]);
    setInputValue("");
  };

  const removeEntry = (index: number) => {
    form.setFieldValue(
      "entries",
      entries.filter((_, i) => i !== index),
    );
  };

  const addSuggestion = (tag: TagWithCount) => {
    form.setFieldValue("entries", [...entries, { id: tag.id, name: tag.name }]);
    setInputValue("");
  };

  const isDirty = !entriesEqual(entries, initialEntries);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="text-balance">Edit Tags</DialogTitle>
        <DialogDescription>
          Organize this bookmark with tags. Type a new name or pick from your
          existing tags.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-4 py-2"
      >
        <div className="space-y-2">
          <Label htmlFor="tag-input" className="text-xs">
            Tags
          </Label>

          <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-input/20 px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
            {entries.map((entry, index) => (
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
              id="tag-input"
              name="tag-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitInput();
                } else if (
                  e.key === "Backspace" &&
                  !inputValue &&
                  entries.length > 0
                ) {
                  e.preventDefault();
                  removeEntry(entries.length - 1);
                }
              }}
              placeholder={
                entries.length === 0 ? "Add a tag..." : "Add another..."
              }
              className="min-w-[8ch] flex-1 bg-transparent text-xs/relaxed outline-none placeholder:text-muted-foreground/60"
            />
          </div>

          {inputValue.trim() && (suggestions.length > 0 || canCreateNew) && (
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

        <DialogFooter>
          {isDirty ? (
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSettingBookmarkTags}>
                {isSettingBookmarkTags ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className={cn("ml-auto")}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
