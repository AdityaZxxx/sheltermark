"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useBookmarkMutations } from "~/hooks/use-bookmarks";
import { useRestoreBookmarks } from "~/lib/mutations/trash.mutations";

interface BookmarkTrashProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  onSuccess: () => void;
  onConfirm?: (ids: string[]) => void | Promise<void>;
}

export function BookmarkTrash({
  open,
  onOpenChange,
  ids,
  onSuccess,
  onConfirm,
}: BookmarkTrashProps) {
  const { deleteBookmarks } = useBookmarkMutations();
  const { mutate: restoreBookmarks } = useRestoreBookmarks();
  const handled = useRef(false);

  const idsRef = useRef(ids);
  const onSuccessRef = useRef(onSuccess);
  const onOpenChangeRef = useRef(onOpenChange);
  const onConfirmRef = useRef(onConfirm);
  const deleteBookmarksRef = useRef(deleteBookmarks);
  const restoreBookmarksRef = useRef(restoreBookmarks);

  idsRef.current = ids;
  onSuccessRef.current = onSuccess;
  onOpenChangeRef.current = onOpenChange;
  onConfirmRef.current = onConfirm;
  deleteBookmarksRef.current = deleteBookmarks;
  restoreBookmarksRef.current = restoreBookmarks;

  useEffect(() => {
    if (!open) {
      handled.current = false;
      return;
    }
    if (handled.current || idsRef.current.length === 0) return;
    handled.current = true;

    const fireToastAndClose = () => {
      const toastId = toast("Moved to trash", {
        action: {
          label: "Undo",
          onClick: () => {
            toast.dismiss(toastId);
            restoreBookmarksRef.current({ ids: idsRef.current });
          },
        },
      });
      onSuccessRef.current();
      onOpenChangeRef.current(false);
    };

    if (onConfirmRef.current) {
      Promise.resolve(onConfirmRef.current(idsRef.current)).then(
        fireToastAndClose,
      );
    } else {
      // Fire toast + close dialog immediately — the underlying
      // useDeleteBookmarks mutation is optimistic (item vanishes from list
      // onMutate), so the user sees instant feedback. The Undo action
      // remains valid during the roundtrip because rollback hasn't happened
      // yet. If the server later fails, the hook rolls back the cache and
      // fires toast.error separately.
      deleteBookmarksRef.current({ ids: idsRef.current });
      fireToastAndClose();
    }
  }, [open]);

  return null;
}
