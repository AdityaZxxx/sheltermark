"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { ShareDialog } from "./share-dialog";

export function ShareDialogManager() {
  const searchParams = useSearchParams();
  const shareUrl = searchParams.get("share_url");
  const shareTitle = searchParams.get("share_title");

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const { workspaces, currentWorkspace } = useWorkspaces();

  useEffect(() => {
    if (shareUrl) {
      setUrl(shareUrl);
      setTitle(shareTitle || "");
      setOpen(true);
    }
  }, [shareUrl, shareTitle]);

  const handleSuccess = useCallback(() => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("share_url");
    newUrl.searchParams.delete("share_title");
    window.history.replaceState({}, "", newUrl.pathname);
  }, []);

  if (!url && !shareUrl) return null;

  return (
    <ShareDialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          handleSuccess();
        }
      }}
      url={url}
      title={title}
      workspaces={workspaces}
      currentWorkspaceId={currentWorkspace?.id}
      onSuccess={handleSuccess}
    />
  );
}
