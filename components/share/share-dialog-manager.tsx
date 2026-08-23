"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useWorkspaces } from "~/hooks/use-workspaces";

import { ShareDialog } from "./share-dialog";

function cleanShareParams() {
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.delete("share_url");
  newUrl.searchParams.delete("share_title");
  window.history.replaceState({}, "", newUrl.pathname);
}

export function ShareDialogManager() {
  const searchParams = useSearchParams();
  const shareUrl = searchParams.get("share_url");
  const shareTitle = searchParams.get("share_title");

  const { workspaces, currentWorkspace } = useWorkspaces();

  // Derive URL and title directly from search params — there's no need
  // to duplicate them into local state. Only keep `open` as local state
  // because the user can dismiss the dialog independently of the URL.
  const [open, setOpen] = useState(!!shareUrl);

  return (
    <ShareDialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          cleanShareParams();
        }
      }}
      url={shareUrl || ""}
      title={shareTitle || ""}
      workspaces={workspaces}
      currentWorkspaceId={currentWorkspace?.id}
      onSuccess={cleanShareParams}
    />
  );
}
