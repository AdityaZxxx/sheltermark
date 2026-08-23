"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useRestoreBookmarks } from "~/lib/mutations/trash.mutations";

interface BookmarkTrashProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  onConfirm: (ids: string[]) => void | Promise<void>;
}

// Headless trigger: fires the confirmed deletion once per dialog opening,
// then shows the Undo toast and closes.
export function BookmarkTrash({
  open,
  onOpenChange,
  ids,
  onConfirm,
}: BookmarkTrashProps) {
  const { mutate: restoreBookmarks } = useRestoreBookmarks();
  const handled = useRef(false);

  const idsRef = useRef(ids);
  const onOpenChangeRef = useRef(onOpenChange);
  const onConfirmRef = useRef(onConfirm);
  const restoreBookmarksRef = useRef(restoreBookmarks);

  // Latest-ref pattern: the [open] effect below and the Undo toast closure
  // read these refs, so they must be synced before that effect runs.
  useEffect(() => {
    idsRef.current = ids;
    onOpenChangeRef.current = onOpenChange;
    onConfirmRef.current = onConfirm;
    restoreBookmarksRef.current = restoreBookmarks;
  });

  useEffect(() => {
    if (!open) {
      handled.current = false;
      return;
    }
    if (handled.current || idsRef.current.length === 0) return;
    handled.current = true;

    const closeWithToast = () => {
      const toastId = toast("Moved to trash", {
        action: {
          label: "Undo",
          onClick: () => {
            toast.dismiss(toastId);
            restoreBookmarksRef.current({ ids: idsRef.current });
          },
        },
      });
      onOpenChangeRef.current(false);
    };

    void Promise.resolve(onConfirmRef.current(idsRef.current)).then(
      closeWithToast,
    );
  }, [open]);

  return null;
}
