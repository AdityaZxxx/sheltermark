"use client";

import { useCallback, useState } from "react";
import type { Tag } from "~/lib/schemas/tag.schema";

interface ActiveBookmark {
  id: string;
  title: string;
  note: string | null;
  tags?: Tag[];
}

export function useBookmarkDialogs() {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
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

  const handleRenameTrigger = useCallback(
    (id: string, bookmarks: { id: string; title: string | null }[]) => {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (bookmark) {
        setActiveBookmark({
          id: bookmark.id,
          title: bookmark.title || "",
          note: null,
        });
        setRenameDialogOpen(true);
      }
    },
    [],
  );

  const handleNoteTrigger = useCallback(
    (
      id: string,
      bookmarks: { id: string; title: string | null; note: string | null }[],
    ) => {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (bookmark) {
        setActiveBookmark({
          id: bookmark.id,
          title: bookmark.title || "",
          note: bookmark.note ?? null,
        });
        setNoteDialogOpen(true);
      }
    },
    [],
  );

  const handleTagTrigger = useCallback(
    (
      id: string,
      bookmarks: {
        id: string;
        title: string | null;
        tags: Tag[];
      }[],
      tagsByBookmarkId: Map<string, string[]>,
      allTags: Tag[],
    ) => {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (!bookmark) return;

      const tagIds = tagsByBookmarkId.get(id) ?? [];
      const tags = tagIds
        .map((tagId) => allTags.find((t) => t.id === tagId))
        .filter((t): t is Tag => t !== undefined);

      setActiveBookmark({
        id: bookmark.id,
        title: bookmark.title || "",
        note: null,
        tags,
      });
      setTagDialogOpen(true);
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

  const resetRename = useCallback(() => {
    setActiveBookmark(null);
    setRenameDialogOpen(false);
  }, []);

  const resetMove = useCallback(() => {
    setBookmarksToMove([]);
    setMoveDialogOpen(false);
  }, []);

  const resetNote = useCallback(() => {
    setActiveBookmark(null);
    setNoteDialogOpen(false);
  }, []);

  const resetTag = useCallback(() => {
    setActiveBookmark(null);
    setTagDialogOpen(false);
  }, []);

  return {
    renameDialogOpen,
    setRenameDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    moveDialogOpen,
    setMoveDialogOpen,
    noteDialogOpen,
    setNoteDialogOpen,
    tagDialogOpen,
    setTagDialogOpen,
    activeBookmark,
    bookmarksToDelete,
    bookmarksToMove,
    handleDeleteTrigger,
    handleBulkDeleteTrigger,
    handleRenameTrigger,
    handleNoteTrigger,
    handleTagTrigger,
    handleMoveTrigger,
    handleBulkMoveTrigger,
    resetDelete,
    resetRename,
    resetMove,
    resetNote,
    resetTag,
  };
}
