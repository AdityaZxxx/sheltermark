"use client";

import {
  BookmarkIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { TagWithCount } from "~/lib/schemas/tag.schema";

import { useSupabase } from "~/components/providers/supabase-provider";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useWorkspaceTagsWithCount } from "~/hooks/use-tags";
import { useDeleteTag, useRenameTag } from "~/lib/mutations/tag.mutations";
import { formatCount } from "~/lib/utils";

import { TagDeleteDialog } from "./tag-delete-dialog";

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

  // Stable identity: fires on mount only (the input unmounts with the
  // dialog), so re-renders while open don't steal focus back from editing.
  const focusSearchOnMount = useCallback((el: HTMLInputElement | null) => {
    el?.focus();
  }, []);

  const totalUsages = tags.reduce((sum, t) => sum + t.count, 0);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? tags.filter((t) => t.name.toLowerCase().includes(q))
    : tags;

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tags</DialogTitle>
            <DialogDescription>
              {formatCount(tags.length, "tag")} in workspace
              {totalUsages > 0 && ` · ${formatCount(totalUsages, "use")}`}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <MagnifyingGlassIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60 pointer-events-none"
              aria-hidden="true"
            />
            <Label htmlFor="tag-search" className="sr-only">
              Search tags
            </Label>
            <Input
              id="tag-search"
              ref={focusSearchOnMount}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-9 pl-7 pr-2.5 text-sm"
            />
          </div>

          <div className="overflow-y-auto max-h-[min(50vh,20rem)]">
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
                  <Button
                    type="button"
                    variant="link"
                    size="default"
                    onClick={() => setSearch("")}
                    className="mt-2 h-8 px-3 text-muted-foreground hover:text-foreground"
                  >
                    Clear search
                  </Button>
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
                      className="flex items-center gap-1.5 rounded-md border border-border/70 bg-card px-2 py-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/10"
                    >
                      <div className="flex-1 min-w-0">
                        <Label htmlFor="tag-rename" className="sr-only">
                          Tag name
                        </Label>
                        <Input
                          id="tag-rename"
                          ref={editInputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              cancelRename();
                            }
                          }}
                          onBlur={(e) => {
                            // Commit when focus leaves the row entirely; skip
                            // when focus moves to the in-row Cancel button.
                            const next =
                              e.relatedTarget instanceof HTMLElement
                                ? e.relatedTarget
                                : null;
                            if (!next || !next.closest("form")) {
                              commitRename();
                            }
                          }}
                          className="min-w-0 h-7 border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0"
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
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label="Save rename"
                        className="hover:bg-muted/50"
                      >
                        <CheckIcon aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={cancelRename}
                        aria-label="Cancel rename"
                        className="hover:bg-muted/50"
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </form>
                  );
                }

                return (
                  <div
                    key={tag.id}
                    className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-[background-color] duration-150 ease-out hover-only:hover:bg-muted/50 focus-within:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {tag.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-muted/60 text-muted-foreground tabular-nums"
                      >
                        <BookmarkIcon aria-hidden="true" />
                        {tag.count}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => startRename(tag)}
                      aria-label={`Rename ${tag.name}`}
                      className="text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground"
                    >
                      <PencilSimpleIcon aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingTag(tag)}
                      aria-label={`Delete ${tag.name}`}
                      className="text-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <TrashIcon aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      <TagDeleteDialog
        tag={deletingTag}
        onOpenChange={(dialogOpen) => {
          if (!dialogOpen) setDeletingTag(null);
        }}
        onConfirm={handleDeleteConfirm}
        isPending={deleteTag.isPending}
      />
    </>
  );
}
