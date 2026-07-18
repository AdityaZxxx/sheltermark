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

    const doAfterDelete = () => {
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
      Promise.resolve(onConfirmRef.current(idsRef.current)).then(doAfterDelete);
    } else {
      deleteBookmarksRef.current(
        { ids: idsRef.current },
        { onSuccess: doAfterDelete },
      );
    }
  }, [open]);

  return null;
}
