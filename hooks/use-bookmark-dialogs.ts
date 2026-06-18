"use client";

import { useCallback, useState } from "react";

interface ActiveBookmark {
  id: string;
  title: string;
  note: string | null;
}

export function useBookmarkDialogs() {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
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

  return {
    renameDialogOpen,
    setRenameDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    moveDialogOpen,
    setMoveDialogOpen,
    noteDialogOpen,
    setNoteDialogOpen,
    activeBookmark,
    bookmarksToDelete,
    bookmarksToMove,
    handleDeleteTrigger,
    handleBulkDeleteTrigger,
    handleRenameTrigger,
    handleNoteTrigger,
    handleMoveTrigger,
    handleBulkMoveTrigger,
    resetDelete,
    resetRename,
    resetMove,
    resetNote,
  };
}
