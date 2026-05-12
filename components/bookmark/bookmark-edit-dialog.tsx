"use client";

import { Sparkle } from "@phosphor-icons/react";
import { useForm, useStore } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { generateAiTitle } from "~/app/action/bookmark.action";
import { MarkdownIcon } from "~/components/markdown-icon";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Textarea } from "~/components/ui/textarea";
import { useUserTagsWithCount } from "~/hooks/use-user-tags";
import type { BookmarkEditInput } from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";
import { entriesEqual, type TagEntry, tagsToEntries } from "~/lib/utils";
import { BookmarkNoteText } from "./bookmark-note-text";
import { TagInput } from "./tag-input";

interface BookmarkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark: {
    id: string;
    title: string;
    note: string | null;
    tags: Tag[];
  } | null;
  updateBookmarkFields: (input: BookmarkEditInput) => void;
  isPending: boolean;
}

function isDirty(
  current: { title: string; note: string | null; tags: TagEntry[] },
  initial: { title: string; note: string | null; tags: TagEntry[] },
): boolean {
  return (
    current.title !== initial.title ||
    current.note !== initial.note ||
    !entriesEqual(current.tags, initial.tags)
  );
}

export function BookmarkEditDialog({
  open,
  onOpenChange,
  bookmark,
  updateBookmarkFields,
  isPending,
}: BookmarkEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && bookmark && (
        <EditFormInner
          key={bookmark.id}
          bookmark={bookmark}
          onOpenChange={onOpenChange}
          updateBookmarkFields={updateBookmarkFields}
          isPending={isPending}
        />
      )}
    </Dialog>
  );
}

function EditFormInner({
  bookmark,
  onOpenChange,
  updateBookmarkFields,
  isPending,
}: Omit<BookmarkEditDialogProps, "open"> & {
  bookmark: NonNullable<BookmarkEditDialogProps["bookmark"]>;
}) {
  const { tags: allUserTags } = useUserTagsWithCount();
  const [generating, setGenerating] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const initialValues = useMemo(
    () => ({
      title: bookmark.title,
      note: bookmark.note,
      tags: tagsToEntries(bookmark.tags),
    }),
    [bookmark.title, bookmark.note, bookmark.tags],
  );

  async function handleGenerateTitle() {
    setGenerating(true);
    setAiSuggestion(null);
    try {
      const result = await generateAiTitle({ bookmarkId: bookmark.id });
      if (result.success) {
        setAiSuggestion(result.data.suggestion);
      } else {
        if (
          result.error?.toLowerCase().includes("rate") ||
          result.error?.toLowerCase().includes("limit")
        ) {
          toast.error("Daily generation limit reached. Try again tomorrow.");
        } else {
          toast.error(result.error || "Failed to generate title");
        }
      }
    } catch {
      toast.error(
        "Failed to generate title. Check your connection and try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: ({ value }) => {
      if (!isDirty(value, initialValues)) {
        onOpenChange(false);
        return;
      }
      const noteValue = value.note?.trim() ? value.note.trim() : null;
      // Optimistic update via parent-provided mutation. The dialog closes
      // immediately and the cache updates behind the scenes. If the server
      // fails, the hook rolls back the cache and fires toast.error.
      updateBookmarkFields({
        id: bookmark.id,
        title: value.title.trim(),
        note: noteValue,
        tags: value.tags.map((e) => (e.id ? { id: e.id } : { name: e.name })),
      });
      onOpenChange(false);
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const dirty = isDirty(values, initialValues);

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-balance">Edit Bookmark</DialogTitle>
        <DialogDescription>
          Update title, note, and tags. Changes save when you click Save.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-5 py-2"
      >
        <form.Field name="title">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="edit-title" className="text-xs">
                Title
              </Label>
              <div className="relative">
                <Input
                  id="edit-title"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoFocus
                  maxLength={200}
                  required
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={handleGenerateTitle}
                  disabled={generating}
                  aria-label="Generate title with AI"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground/70 transition-[color,background-color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Sparkle
                    className={`h-4 w-auto ${generating ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
              {aiSuggestion && (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                  <Sparkle
                    className="size-3.5 shrink-0 text-amber-500"
                    weight="fill"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/90">
                    {aiSuggestion}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-7 text-[11px] px-2.5"
                    onClick={() => {
                      field.handleChange(aiSuggestion);
                      setAiSuggestion(null);
                    }}
                  >
                    Apply
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] px-2.5"
                    onClick={() => setAiSuggestion(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="note">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="edit-note" className="text-xs">
                Note
              </Label>
              <div className="relative">
                <Textarea
                  id="edit-note"
                  name={field.name}
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Why did you save this?..."
                  rows={4}
                  maxLength={2000}
                  className="pr-10"
                />
                <Popover>
                  <PopoverTrigger
                    aria-label="Markdown formatting supported"
                    className="absolute right-1.5 bottom-0.5 inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground/70 transition-[color,background-color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <MarkdownIcon className="h-4 w-auto" aria-hidden="true" />
                  </PopoverTrigger>
                  <PopoverContent align="end" side="top" className="w-full">
                    <PopoverHeader>
                      <PopoverTitle>Styling with Markdown</PopoverTitle>
                    </PopoverHeader>
                    <div className="space-y-2">
                      <MarkdownExample
                        syntax="**bold text**"
                        preview="**bold text**"
                      />
                      <MarkdownExample
                        syntax="*italic text*"
                        preview="*italic text*"
                      />
                      <MarkdownExample
                        syntax="`inline code`"
                        preview="`inline code`"
                      />
                      <MarkdownExample
                        syntax="[link text](https://example.com)"
                        preview="[link text](https://example.com)"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </form.Field>

        <form.Field name="tags">
          {(field) => (
            <TagInput
              value={field.state.value}
              onChange={(next) => field.handleChange(next)}
              allUserTags={allUserTags}
            />
          )}
        </form.Field>

        <DialogFooter>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !dirty}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function MarkdownExample({
  syntax,
  preview,
}: {
  syntax: string;
  preview: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <code className="shrink-0 font-mono text-xs text-muted-foreground">
        {syntax}
      </code>
      <span className="shrink-0 text-xs text-muted-foreground">→</span>
      <div className="min-w-0 flex-1 truncate text-xs text-foreground">
        <BookmarkNoteText text={preview} />
      </div>
    </div>
  );
}
