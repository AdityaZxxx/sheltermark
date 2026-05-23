"use client";

import { useCallback, useState } from "react";

import type { Tag } from "~/lib/schemas/tag.schema";

interface ActiveBookmark {
  id: string;
  title: string;
  note: string | null;
  tags: Tag[];
}

export function useBookmarkDialogs() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [activeBookmark, setActiveBookmark] = useState<ActiveBookmark | null>(
    null,
  );
  const [bookmarksToDelete, setBookmarksToDelete] = useState<string[]>([]);
  const [bookmarksToMove, setBookmarksToMove] = useState<string[]>([]);

  const handleDeleteTrigger = useCallback((id: string) => {
    setBookmarksToDelete([id]);
    setDeleteDialogOpen(true);
  }, []);

  const handleBulkDeleteTrigger = useCallback((selectedIds: string[]) => {
    setBookmarksToDelete(selectedIds);
    setDeleteDialogOpen(true);
  }, []);

  const handleEditTrigger = useCallback(
    (
      id: string,
      bookmarks: {
        id: string;
        title: string | null;
        note: string | null;
        tagsByBookmarkId: Map<string, string[]>;
        allTags: Tag[];
      }[],
    ) => {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (!bookmark) return;

      const tagIds = bookmark.tagsByBookmarkId.get(id) ?? [];
      const tags = tagIds
        .map((tagId) => bookmark.allTags.find((t) => t.id === tagId))
        .filter((t): t is Tag => t !== undefined);

      setActiveBookmark({
        id: bookmark.id,
        title: bookmark.title || "",
        note: bookmark.note ?? null,
        tags,
      });
      setEditDialogOpen(true);
    },
    [],
  );

  const handleMoveTrigger = useCallback((id: string) => {
    setBookmarksToMove([id]);
    setMoveDialogOpen(true);
  }, []);

  const handleBulkMoveTrigger = useCallback((selectedIds: string[]) => {
    setBookmarksToMove(selectedIds);
    setMoveDialogOpen(true);
  }, []);

  const resetDelete = useCallback(() => {
    setBookmarksToDelete([]);
    setDeleteDialogOpen(false);
  }, []);

  const resetEdit = useCallback(() => {
    setActiveBookmark(null);
    setEditDialogOpen(false);
  }, []);

  const resetMove = useCallback(() => {
    setBookmarksToMove([]);
    setMoveDialogOpen(false);
  }, []);

  return {
    editDialogOpen,
    setEditDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    moveDialogOpen,
    setMoveDialogOpen,
    activeBookmark,
    bookmarksToDelete,
    bookmarksToMove,
    handleDeleteTrigger,
    handleBulkDeleteTrigger,
    handleEditTrigger,
    handleMoveTrigger,
    handleBulkMoveTrigger,
    resetDelete,
    resetEdit,
    resetMove,
  };
}
