"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { updateBookmarkNote } from "~/app/action/bookmark.action";
import { MarkdownIcon } from "~/components/markdown-icon";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Textarea } from "~/components/ui/textarea";
import { BookmarkNoteText } from "./bookmark-note-text";

interface BookmarkNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark: { id: string; title: string; note: string | null } | null;
  onSuccess: () => void;
  onConfirm?: (id: string, note: string | null) => void | Promise<void>;
  silent?: boolean;
}

export function BookmarkNoteDialog({
  open,
  onOpenChange,
  bookmark,
  onSuccess,
  onConfirm,
  silent = false,
}: BookmarkNoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && bookmark && (
        <NoteFormInner
          bookmark={bookmark}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
          onConfirm={onConfirm}
          silent={silent}
        />
      )}
    </Dialog>
  );
}

function NoteFormInner({
  bookmark,
  onOpenChange,
  onSuccess,
  onConfirm,
  silent,
}: Omit<BookmarkNoteDialogProps, "open"> & {
  bookmark: NonNullable<BookmarkNoteDialogProps["bookmark"]>;
}) {
  const form = useForm({
    defaultValues: { note: bookmark.note ?? "" },
    onSubmit: async ({ value }) => {
      const trimmed = value.note.trim();
      const noteValue = trimmed === "" ? null : trimmed;

      // Skip network request if nothing changed
      if (noteValue === bookmark.note) {
        return;
      }

      try {
        if (onConfirm) {
          await onConfirm(bookmark.id, noteValue);
        } else {
          const res = await updateBookmarkNote({
            id: bookmark.id,
            note: noteValue,
          });
          if (!res.success) {
            toast.error(
              res.error ||
                "Failed to save note. Check your connection and try again.",
            );
            return;
          }
        }
        if (!silent) toast.success("Note saved");
        onSuccess();
      } catch {
        toast.error(
          "Failed to save note. Check your connection and try again.",
        );
      }
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const noteValue = useStore(form.store, (state) => state.values.note);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="text-balance">
          {bookmark.note ? "Edit Note" : "Add Note"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <form.Field name="note">
          {(field) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                {isSubmitting && (
                  <span
                    className="text-[11px] text-muted-foreground animate-pulse motion-reduce:animate-none"
                    aria-live="polite"
                  >
                    Saving…
                  </span>
                )}
              </div>
              <div className="relative">
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  autoFocus
                  onBlur={() => {
                    field.handleBlur();
                    void form.handleSubmit();
                  }}
                  placeholder="Why did you save this?..."
                  rows={4}
                  className="pr-10"
                />
                <Popover>
                  <PopoverTrigger
                    aria-label="Markdown formatting supported"
                    className="absolute right-1.5 bottom-1.5 inline-flex h-6 w-[26px] items-center justify-center rounded-sm text-muted-foreground/70 transition-[color,background-color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <MarkdownIcon className="h-4 w-auto" aria-hidden="true" />
                  </PopoverTrigger>
                  <PopoverContent align="end" side="top" className="w-full">
                    <PopoverHeader>
                      <PopoverTitle>
                        Styling with Markdown is supported
                      </PopoverTitle>
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
        <DialogFooter>
          {noteValue.trim() ? (
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.setFieldValue("note", bookmark.note ?? "");
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => void form.handleSubmit()}
              >
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </div>
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
