"use client";

import {
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  TagIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSupabase } from "~/components/providers/supabase-provider";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "~/components/ui/dialog";
import { useWorkspaceTagsWithCount } from "~/hooks/use-user-tags";
import { useDeleteTag, useRenameTag } from "~/lib/mutations/tag.mutations";
import type { TagWithCount } from "~/lib/schemas/tag.schema";

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
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
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

  const startRenaming = (tag: TagWithCount) => {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
    setConfirmingDeleteId(null);
    // Double rAF, not one: the pencil unmounts when editingTagId flips, focus briefly
    // lands on document.body, and Base UI's FloatingFocusManager (`restoreFocus:"popup"`)
    // queues an rAF to steal focus back to the dialog container. A single rAF runs
    // before that restore, so the input focuses then immediately blurs (onBlur →
    // commitRename fires before the user sees anything). The second rAF schedules our
    // focus after the restore, so the input keeps focus.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editInputRef.current?.focus();
      });
    });
  };

  const commitRename = () => {
    const currentId = editingTagId;
    if (!currentId) return;

    const trimmed = editingName.trim();
    if (!trimmed || trimmed === tags.find((t) => t.id === currentId)?.name) {
      setEditingTagId(null);
      setEditingName("");
      return;
    }

    renameTag.mutate(
      { tagId: currentId, name: trimmed },
      {
        onSuccess: () => {
          setEditingTagId(null);
          setEditingName("");
        },
        onError: () => {
          toast.error("Failed to rename tag. Please try again.");
        },
      },
    );
  };

  const cancelRenaming = () => {
    setEditingTagId(null);
    setEditingName("");
  };

  const handleDeleteConfirm = (tagId: string) => {
    deleteTag.mutate(
      { tagId },
      {
        onSuccess: () => {
          setConfirmingDeleteId(null);
        },
        onError: () => {
          toast.error("Failed to delete tag. Please try again.");
        },
      },
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setEditingTagId(null);
      setEditingName("");
      setConfirmingDeleteId(null);
      setSearch("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0" showCloseButton={false}>
        <div className="flex items-center justify-between p-4 pb-3">
          <div>
            <DialogTitle className="text-sm">Tags</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tags.length} tag{tags.length !== 1 ? "s" : ""} in workspace
              {totalUsages > 0 && ` · ${totalUsages} uses`}
            </p>
          </div>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                className="text-muted-foreground active:scale-[0.97] transition-[colors,transform] duration-100 ease-out"
              />
            }
          >
            <XIcon className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="px-4 pb-2">
          <div className="relative">
            <MagnifyingGlassIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60 pointer-events-none"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tags…"
              className="w-full h-9 rounded-md border border-input bg-input/20 pl-7 pr-2.5 text-sm outline-none placeholder:text-muted-foreground/60 transition-colors focus:border-ring focus:ring-1 focus:ring-ring/30"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[50vh] px-1 py-1">
          {isLoading && (
            <p className="text-xs text-muted-foreground py-8 text-center">
              Loading tags…
            </p>
          )}

          {!isLoading && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground py-8 text-center">
              {search
                ? "No tags match your search"
                : "No tags in this workspace"}
            </p>
          )}

          {!isLoading &&
            filtered.map((tag) => {
              if (confirmingDeleteId === tag.id) {
                return (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-destructive/10"
                  >
                    <span className="text-xs text-foreground flex-1 min-w-0">
                      Delete{" "}
                      <span className="font-medium">
                        &ldquo;{tag.name}&rdquo;
                      </span>
                      ?
                      {tag.count > 0 && (
                        <span className="text-muted-foreground">
                          {" "}
                          Removes it from{" "}
                          <span className="font-medium text-foreground">
                            {tag.count === 1
                              ? "1 bookmark"
                              : `${tag.count} bookmarks`}
                          </span>
                          .
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="h-8 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground active:scale-[0.97] transition-[colors,transform] duration-100 ease-out"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteConfirm(tag.id)}
                        disabled={deleteTag.isPending}
                        className="h-8 rounded-md px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-[colors,transform] duration-100 ease-out disabled:pointer-events-none disabled:opacity-50"
                      >
                        {deleteTag.isPending ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              }

              const isEditing = editingTagId === tag.id;

              return (
                <div
                  key={tag.id}
                  className={`group flex items-center gap-3 rounded-lg px-4 py-2.5 transition-[background-color,box-shadow] duration-150 ease-out ${
                    isEditing
                      ? "bg-muted/60 -mx-1 px-5 shadow-sm ring-1 ring-border"
                      : "hover-only:hover:bg-muted/50"
                  }`}
                >
                  <TagIcon
                    className="size-3 shrink-0 text-muted-foreground/40"
                    aria-hidden="true"
                  />

                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={(e) => {
                        // Guard: skip committing if focus moved to an in-row sibling
                        // (mousedown on a sibling button fires onBlur before the click
                        // event reaches React — prevents the rename form from closing
                        // silently on the first click).
                        const related = e.relatedTarget as HTMLElement | null;
                        if (!related?.closest("[class*='group']")) {
                          commitRename();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRenaming();
                        }
                      }}
                      className="min-w-0 flex-1 h-6 border-0 bg-transparent p-0 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60"
                      maxLength={50}
                      autoComplete="off"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {tag.name}
                    </span>
                  )}

                  <span className="text-xs text-muted-foreground/60 shrink-0 tabular-nums">
                    {tag.count === 1 ? "1 use" : `${tag.count} uses`}
                  </span>

                  {!isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={() => startRenaming(tag)}
                        aria-label={`Rename ${tag.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-[0.97] transition-[colors,transform] duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring -mr-0.5"
                      >
                        <PencilSimpleIcon
                          className="size-3"
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingDeleteId(tag.id);
                          setEditingTagId(null);
                        }}
                        aria-label={`Delete ${tag.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-[colors,transform] duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring -mr-1"
                      >
                        <TrashIcon className="size-3" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}

          {/* Bottom spacer for scroll feel */}
          <div className="h-1" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
