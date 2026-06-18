"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import { updateBookmarkFields } from "~/app/action/bookmark.action";
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
  onSuccess: () => void;
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
  onSuccess,
}: BookmarkEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && bookmark && (
        <EditFormInner
          key={bookmark.id}
          bookmark={bookmark}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  );
}

function EditFormInner({
  bookmark,
  onOpenChange,
  onSuccess,
}: Omit<BookmarkEditDialogProps, "open"> & {
  bookmark: NonNullable<BookmarkEditDialogProps["bookmark"]>;
}) {
  const { tags: allUserTags } = useUserTagsWithCount();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialValues = useMemo(
    () => ({
      title: bookmark.title,
      note: bookmark.note,
      tags: tagsToEntries(bookmark.tags),
    }),
    [bookmark.title, bookmark.note, bookmark.tags],
  );

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      if (!isDirty(value, initialValues)) {
        onOpenChange(false);
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const noteValue = value.note?.trim() ? value.note.trim() : null;
        const res = await updateBookmarkFields({
          id: bookmark.id,
          title: value.title.trim(),
          note: noteValue,
          tags: value.tags.map((e) => (e.id ? { id: e.id } : { name: e.name })),
        });
        if (res.success) {
          onSuccess();
          onOpenChange(false);
        } else {
          setError(
            res.error ||
              "Failed to save changes. Check your connection and try again.",
          );
        }
      } catch {
        setError(
          "Failed to save changes. Check your connection and try again.",
        );
      } finally {
        setSubmitting(false);
      }
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
              <Input
                id="edit-title"
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                autoFocus
                maxLength={200}
                required
              />
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

        {error && (
          <p
            className="text-[11px] text-destructive"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}

        <DialogFooter>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !dirty}>
              {submitting ? "Saving…" : "Save Changes"}
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
      <code className="shrink-0 font-mono text-[11px] text-muted-foreground">
        {syntax}
      </code>
      <span className="shrink-0 text-[11px] text-muted-foreground/60">→</span>
      <div className="min-w-0 flex-1 truncate text-[11px] text-foreground/90">
        <BookmarkNoteText text={preview} />
      </div>
    </div>
  );
}
