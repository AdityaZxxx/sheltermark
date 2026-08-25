"use client";

import { Sparkle } from "@phosphor-icons/react";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";

import type { BookmarkEditInput } from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";

import {
  generateAiTitle,
  suggestBookmarkTags,
} from "~/app/action/bookmark.action";
import { TagInput } from "~/components/tag/tag-input";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useUserTagsWithCount } from "~/hooks/use-tags";
import {
  entriesEqual,
  mergeSuggestedTags,
  type TagEntry,
  tagsToEntries,
} from "~/lib/utils/tag-entries";

import { BookmarkNoteText } from "./bookmark-note-text";
import { MarkdownIcon } from "./markdown-icon";
import { Orb } from "./orb";

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
  const [suggesting, setSuggesting] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[] | null>(null);

  const initialValues = {
    title: bookmark.title,
    note: bookmark.note,
    tags: tagsToEntries(bookmark.tags),
  };

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
    }
    setGenerating(false);
  }

  async function handleSuggestTags() {
    setSuggesting(true);
    setTagSuggestions(null);
    try {
      const result = await suggestBookmarkTags({ bookmarkId: bookmark.id });
      if (result.success) {
        setTagSuggestions(result.data.suggestions);
      } else {
        toast.error(result.error || "Failed to suggest tags");
      }
    } catch {
      toast.error(
        "Failed to suggest tags. Check your connection and try again.",
      );
    }
    setSuggesting(false);
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
    <DialogContent className="max-h-[85vh] flex flex-col gap-0 overflow-hidden p-0">
      <DialogHeader className="px-6 pt-6 pb-4">
        <DialogTitle className="text-balance">Edit Bookmark</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-2">
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
                    // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional: dialog opens with focus in the title input
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-[color,background-color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:bg-muted"
                  >
                    {generating ? (
                      <span aria-hidden="true" className="inline-flex">
                        <Orb size={24} />
                      </span>
                    ) : (
                      <Sparkle className="h-4 w-auto" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {aiSuggestion && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
                    <Sparkle
                      className="size-3.5 shrink-0 text-amber-500"
                      weight="fill"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 line-clamp-2 text-[13px] text-foreground/90">
                      {aiSuggestion}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
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
                        onClick={() => setAiSuggestion(null)}
                      >
                        Dismiss
                      </Button>
                    </div>
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
                      className="absolute right-2 bottom-0.5 inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-[color,background-color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:bg-muted"
                    >
                      <MarkdownIcon className="h-4 w-auto" aria-hidden="true" />
                    </PopoverTrigger>
                    <PopoverContent align="end" side="top" className="w-72 p-3">
                      <PopoverHeader>
                        <PopoverTitle>Markdown</PopoverTitle>
                      </PopoverHeader>
                      <p className="text-xs text-muted-foreground">
                        Inline formatting only.
                      </p>
                      <div className="mt-2 space-y-1.5">
                        <MarkdownExample label="Bold" source="**Important**" />
                        <MarkdownExample label="Italic" source="*note*" />
                        <MarkdownExample label="Code" source="`const x = 1`" />
                        <MarkdownExample
                          label="Link"
                          source="[Sheltermark](https://example.com)"
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
              <div className="space-y-2">
                <TagInput
                  value={field.state.value}
                  onChange={(next) => field.handleChange(next)}
                  allUserTags={allUserTags}
                />
                <div>
                  <output className="sr-only">
                    {suggesting ? "Suggesting tags..." : ""}
                  </output>
                  {suggesting ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Orb size={16} />
                      Suggesting...
                    </span>
                  ) : !tagSuggestions ? (
                    <button
                      type="button"
                      onClick={handleSuggestTags}
                      className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
                    >
                      <Sparkle className="size-3.5" aria-hidden="true" />
                      Suggest tags
                    </button>
                  ) : tagSuggestions.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No tag suggestions.
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tagSuggestions.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            field.handleChange(
                              mergeSuggestedTags(
                                field.state.value,
                                [name],
                                allUserTags,
                              ),
                            );
                            setTagSuggestions(
                              (prev) => prev?.filter((n) => n !== name) ?? null,
                            );
                          }}
                          aria-label={`Apply suggested tag ${name}`}
                          className="inline-flex h-6 items-center gap-0.5 rounded-full border border-dashed border-border/70 px-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:bg-accent focus-visible:text-accent-foreground"
                        >
                          <Sparkle className="size-3" aria-hidden="true" />
                          {name}
                        </button>
                      ))}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            field.handleChange(
                              mergeSuggestedTags(
                                field.state.value,
                                tagSuggestions,
                                allUserTags,
                              ),
                            );
                            setTagSuggestions(null);
                          }}
                        >
                          Add all
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-muted-foreground"
                          onClick={() => setTagSuggestions(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </form.Field>
        </div>

        <DialogFooter className="flex-row justify-end sticky bottom-0 border-t border-border/60 bg-background px-6 py-3">
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
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function MarkdownExample({ label, source }: { label: string; source: string }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] items-baseline gap-x-3 rounded-md bg-muted/60 px-3 py-1.5">
      <span className="row-span-2 self-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <code className="truncate font-mono text-[11px] text-muted-foreground">
        {source}
      </code>
      <div className="min-w-0 truncate text-xs text-foreground">
        <BookmarkNoteText text={source} />
      </div>
    </div>
  );
}
