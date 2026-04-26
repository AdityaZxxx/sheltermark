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
    const url = new URL(window.location.href);
    url.searchParams.delete("share_url");
    url.searchParams.delete("share_title");
    window.history.replaceState({}, "", url.pathname);
  }, []);

  if (!shareUrl) return null;

  return (
    <ShareDialog
      open={open}
      onOpenChange={setOpen}
      url={url}
      title={title}
      workspaces={workspaces}
      currentWorkspaceId={currentWorkspace?.id}
      onSuccess={handleSuccess}
    />
  );
}
