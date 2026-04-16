"use client";

import { GearIcon, UserIcon } from "@phosphor-icons/react";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { toast } from "sonner";
import { deleteAccount } from "~/app/action/setting";
import { ExportDialog } from "~/components/import-export/export-dialog";
import { ImportDialog } from "~/components/import-export/import-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { SettingsGeneralTab } from "./setting-general-tab";
import { SettingsProfileTab } from "./setting-profile-tab";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}

export function SettingsDialog({
  open,
  onOpenChange,
  user,
}: SettingsDialogProps) {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const isChildDialogOpen =
    exportDialogOpen || importDialogOpen || deleteAlertOpen;

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== user.email?.toLowerCase()) {
      toast.error("Enter your email to confirm");
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteAccount();

      if (result.error) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      toast.success("Account deleted successfully");
      window.location.href = "/";
    } finally {
      setIsDeleting(false);
      setDeleteAlertOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col max-h-[95vh] transition-all duration-200"
        style={{
          filter: isChildDialogOpen ? "blur(8px)" : undefined,
          opacity: isChildDialogOpen ? 0.5 : undefined,
        }}
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account settings.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">
              <GearIcon className="size-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex-1">
              <UserIcon className="size-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="general"
            className="flex-1 overflow-y-auto overflow-x-hidden -mx-2 px-2 my-6"
          >
            <SettingsGeneralTab
              user={user}
              onCancel={() => onOpenChange(false)}
              onOpenExportDialog={() => setExportDialogOpen(true)}
              onOpenImportDialog={() => setImportDialogOpen(true)}
              onOpenDeleteAlert={() => {
                setDeleteAlertOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent
            value="profile"
            className="flex-1 overflow-y-auto overflow-x-hidden -mx-2 px-2 my-6"
          >
            <SettingsProfileTab onCancel={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription className="mt-2 text-left">
              This will permanently delete your account and all your data,
              including workspaces and bookmarks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Type your email{" "}
              <span className="font-medium text-foreground">{user.email}</span>{" "}
              to confirm.
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Enter your email"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={
                deleteConfirmText.toLowerCase() !== user.email?.toLowerCase() ||
                isDeleting
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
