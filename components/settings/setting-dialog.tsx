"use client";

import { GearIcon, UserIcon } from "@phosphor-icons/react";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { toast } from "sonner";
import { deleteAccount } from "~/app/action/setting.action";
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
import { SettingsDialogFooter } from "./setting-dialog-footer";
import { SettingsGeneralTab } from "./setting-general-tab";
import { SettingsProfileTab } from "./setting-profile-tab";

interface SettingsFooterState {
  isSubmitting: boolean;
  isDirty: boolean;
  isDisabled?: boolean;
  onSubmit: () => void;
}

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
  const [footerState, setFooterState] = useState<SettingsFooterState | null>(
    null,
  );
  const isChildDialogOpen =
    exportDialogOpen || importDialogOpen || deleteAlertOpen;

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== user.email?.toLowerCase()) {
      toast.error("Enter your email to confirm");
      return;
    }

    setIsDeleting(true);
    const result = await deleteAccount();

    if (!result.success) {
      toast.error(result.error);
    } else {
      toast.success("Account deleted successfully");
      window.location.href = "/";
    }
    setIsDeleting(false);
    setDeleteAlertOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col max-h-[95vh] gap-0 overflow-hidden p-0 transition-all duration-200"
        style={{
          filter: isChildDialogOpen ? "blur(8px)" : undefined,
          opacity: isChildDialogOpen ? 0.5 : undefined,
        }}
      >
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account settings.</DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="general"
          className="flex flex-1 flex-col min-h-0 gap-3"
        >
          <div className="px-4">
            <TabsList className="w-full">
              <TabsTrigger value="general">
                <GearIcon className="size-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="profile">
                <UserIcon className="size-4" />
                Profile
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="flex flex-1 min-h-0 flex-col">
            <SettingsGeneralTab
              user={user}
              onCancel={() => onOpenChange(false)}
              onOpenExportDialog={() => setExportDialogOpen(true)}
              onOpenImportDialog={() => setImportDialogOpen(true)}
              onOpenDeleteAlert={() => {
                setDeleteAlertOpen(true);
              }}
              onRegisterFooter={setFooterState}
            />
          </TabsContent>

          <TabsContent value="profile" className="flex flex-1 min-h-0 flex-col">
            <SettingsProfileTab
              onCancel={() => onOpenChange(false)}
              onRegisterFooter={setFooterState}
            />
          </TabsContent>
        </Tabs>

        {footerState && (
          <SettingsDialogFooter
            isSubmitting={footerState.isSubmitting}
            isDirty={footerState.isDirty}
            isDisabled={footerState.isDisabled}
            onCancel={() => onOpenChange(false)}
            onSubmit={footerState.onSubmit}
          />
        )}
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
