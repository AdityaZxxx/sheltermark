"use client";

import {
  HashIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TagDeleteDialog } from "~/components/bookmark/tag-delete-dialog";
import { useSupabase } from "~/components/providers/supabase-provider";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { useWorkspaceTagsWithCount } from "~/hooks/use-user-tags";
import { useDeleteTag, useRenameTag } from "~/lib/mutations/tag.mutations";
import type { TagWithCount } from "~/lib/schemas/tag.schema";
import { formatCount } from "~/lib/utils";

interface TagManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
}

export function TagManageDialog({
  open,
  onOpenChange,
  workspaceId,
}: TagManageDialogProps) {
  const { user } = useSupabase();
  const { tags, isLoading } = useWorkspaceTagsWithCount(workspaceId);
  const deleteTag = useDeleteTag(user?.id);
  const renameTag = useRenameTag(user?.id);

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [deletingTag, setDeletingTag] = useState<TagWithCount | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const totalUsages = useMemo(
    () => tags.reduce((sum, t) => sum + t.count, 0),
    [tags],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  // Focus the rename input when a row enters edit mode.
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  function startRename(tag: TagWithCount) {
    setEditingId(tag.id);
    setEditingName(tag.name);
    setInlineError(null);
  }

  function cancelRename() {
    setEditingId(null);
    setEditingName("");
    setInlineError(null);
  }

  function commitRename(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!editingId) return;
    const trimmed = editingName.trim();
    const original = tags.find((t) => t.id === editingId)?.name;
    if (!trimmed || trimmed === original) {
      cancelRename();
      return;
    }
    renameTag.mutate(
      { tagId: editingId, name: trimmed },
      {
        onSuccess: (result) => {
          if (!result) return;
          if (result.success) {
            cancelRename();
          } else {
            setInlineError(result.error || "Unable to rename tag.");
          }
        },
        onError: () => {
          setInlineError("Unable to rename tag. Check your connection.");
        },
      },
    );
  }

  function handleDeleteConfirm(tagId: string) {
    deleteTag.mutate(
      { tagId },
      {
        onSuccess: (result) => {
          if (result?.success) {
            setDeletingTag(null);
          }
        },
      },
    );
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSearch("");
      cancelRename();
      setDeletingTag(null);
    }
    onOpenChange(next);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-sm gap-0 p-0"
          showCloseButton={false}
        >
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <div>
              <DialogTitle className="text-sm">Tags</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {formatCount(tags.length, "tag")} in workspace
                {totalUsages > 0 && ` · ${formatCount(totalUsages, "use")}`}
              </DialogDescription>
            </div>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground active:scale-[0.97] transition-[colors,transform] duration-100 ease-out"
                />
              }
            >
              <XIcon className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>

          <div className="px-3 pt-1 pb-2">
            <div className="relative">
              <MagnifyingGlassIcon
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60 pointer-events-none"
                aria-hidden="true"
              />
              <label htmlFor="tag-search" className="sr-only">
                Search tags
              </label>
              <input
                id="tag-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tags…"
                className="w-full h-9 rounded-md border border-input bg-input/20 pl-7 pr-2.5 text-sm outline-none placeholder:text-muted-foreground/60 transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[min(50vh,20rem)] px-3 pb-3">
            {isLoading && (
              <p
                aria-live="polite"
                className="text-xs text-muted-foreground py-8 text-center"
              >
                Loading tags…
              </p>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  {search
                    ? `No tags for “${search.trim()}”`
                    : "No tags in this workspace"}
                </p>
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-2 h-8 rounded-md px-3 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline active:scale-[0.97] transition-[colors,transform] duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    Clear search
                  </button>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    Tags group your bookmarks. Add one from any bookmark.
                  </p>
                )}
              </div>
            )}

            {!isLoading &&
              filtered.map((tag) => {
                if (editingId === tag.id) {
                  return (
                    <form
                      key={tag.id}
                      onSubmit={commitRename}
                      className="flex items-center gap-2 rounded-md px-2 py-2 bg-muted/60 shadow-sm ring-1 ring-border"
                    >
                      <HashIcon
                        className="size-3 shrink-0 text-muted-foreground/40"
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <label htmlFor="tag-rename" className="sr-only">
                          Tag name
                        </label>
                        <input
                          id="tag-rename"
                          ref={editInputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          onBlur={(e) => {
                            // Commit when focus leaves the row entirely; skip
                            // when focus moves to the in-row Cancel button.
                            const next = e.relatedTarget as HTMLElement | null;
                            if (!next || !next.closest("form")) {
                              commitRename();
                            }
                          }}
                          className="min-w-0 w-full h-6 border-0 bg-transparent p-0 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60"
                          maxLength={50}
                          autoComplete="off"
                          aria-invalid={inlineError ? true : undefined}
                          aria-describedby={
                            inlineError ? `tag-error-${tag.id}` : undefined
                          }
                        />
                        {inlineError && (
                          <p
                            id={`tag-error-${tag.id}`}
                            role="alert"
                            className="mt-1 text-destructive text-xs"
                          >
                            {inlineError}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={cancelRename}
                        aria-label="Cancel rename"
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-[0.97] transition-[colors,transform] duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <XIcon className="size-3" aria-hidden="true" />
                      </button>
                    </form>
                  );
                }

                return (
                  <div
                    key={tag.id}
                    className="group flex items-center gap-2 rounded-md px-2 py-2 transition-[background-color,box-shadow] duration-150 ease-out hover-only:hover:bg-muted/50"
                  >
                    <HashIcon
                      className="size-3 shrink-0 text-muted-foreground/40"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {tag.name}
                    </span>
                    <span className="text-xs text-muted-foreground/60 shrink-0 tabular-nums">
                      {formatCount(tag.count, "use")}
                    </span>
                    <button
                      type="button"
                      onClick={() => startRename(tag)}
                      aria-label={`Rename ${tag.name}`}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-[0.97] transition-[colors,transform] duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <PencilSimpleIcon className="size-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingTag(tag)}
                      aria-label={`Delete ${tag.name}`}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-[colors,transform] duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <TrashIcon className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      <TagDeleteDialog
        tag={deletingTag}
        onOpenChange={(open) => {
          if (!open) setDeletingTag(null);
        }}
        onConfirm={handleDeleteConfirm}
        isPending={deleteTag.isPending}
      />
    </>
  );
}
