"use client";

import { GearIcon, ShieldCheckIcon, UserIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

import {
  signOutAllSessions,
  signOutOtherSessions,
} from "~/app/action/session.action";
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
import { GENERIC_ERROR } from "~/lib/action-result";
import { cn } from "~/lib/utils";

import { RestoreDialog } from "./restore-dialog";
import { SettingsDialogFooter } from "./setting-dialog-footer";
import { SettingsGeneralTab } from "./setting-general-tab";
import { SettingsProfileTab } from "./setting-profile-tab";
import {
  pressFeedback,
  SettingsSecurityTab,
  type RemoteSignOutScope,
} from "./setting-security-tab";

interface SettingsFooterState {
  isSubmitting: boolean;
  isDirty: boolean;
  isDisabled?: boolean;
  onSubmit: () => void;
}

const SIGN_OUT_CONFIRM_COPY = {
  others: {
    title: "Sign out other devices?",
    description:
      "All your other signed-in devices and browsers will be logged out. This device stays signed in.",
    action: "Sign Out Others",
  },
  global: {
    title: "Sign out everywhere?",
    description:
      "All devices, including this one, will be logged out. You'll need to log in again everywhere.",
    action: "Sign Out Everywhere",
  },
} satisfies Record<
  RemoteSignOutScope,
  { title: string; description: string; action: string }
>;

import { useUser } from "~/components/providers/user-context";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const user = useUser();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [signOutScope, setSignOutScope] = useState<RemoteSignOutScope | null>(
    null,
  );
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [footerState, setFooterState] = useState<SettingsFooterState | null>(
    null,
  );
  // The Security tab has no form footer; the shared footer only renders
  // for tabs that registered one.
  const [activeTab, setActiveTab] = useState("general");
  const isChildDialogOpen =
    exportDialogOpen ||
    importDialogOpen ||
    restoreDialogOpen ||
    signOutScope !== null ||
    deleteAlertOpen;

  const handleSignOut = async () => {
    if (!signOutScope) return;
    const scope = signOutScope;
    setIsSigningOut(true);
    try {
      const result =
        scope === "global"
          ? await signOutAllSessions()
          : await signOutOtherSessions();
      if (!result.success) {
        toast.error(result.error);
      } else if (scope === "global") {
        toast.success("Signed out everywhere");
        window.location.href = "/login";
        return;
      } else {
        toast.success("Signed out on other devices");
      }
    } catch {
      toast.error(GENERIC_ERROR);
    }
    setIsSigningOut(false);
    setSignOutScope(null);
  };

  const signOutCopy = signOutScope ? SIGN_OUT_CONFIRM_COPY[signOutScope] : null;

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== user.email?.toLowerCase()) {
      toast.error("Enter your email to confirm");
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteAccount();
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success("Account deleted successfully");
        window.location.href = "/";
      }
    } catch {
      toast.error(GENERIC_ERROR);
    }
    setIsDeleting(false);
    setDeleteAlertOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col h-[90vh] gap-0 overflow-hidden p-0"
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
          value={activeTab}
          onValueChange={setActiveTab}
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
              <TabsTrigger value="security">
                <ShieldCheckIcon className="size-4" />
                Security
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="flex flex-1 min-h-0 flex-col">
            <SettingsGeneralTab
              onCancel={() => onOpenChange(false)}
              onOpenExportDialog={() => setExportDialogOpen(true)}
              onOpenImportDialog={() => setImportDialogOpen(true)}
              onOpenRestoreDialog={() => setRestoreDialogOpen(true)}
              onRegisterFooter={setFooterState}
            />
          </TabsContent>

          <TabsContent value="profile" className="flex flex-1 min-h-0 flex-col">
            <SettingsProfileTab
              onCancel={() => onOpenChange(false)}
              onRegisterFooter={setFooterState}
            />
          </TabsContent>

          <TabsContent
            value="security"
            className="flex flex-1 min-h-0 flex-col"
          >
            <SettingsSecurityTab
              onOpenSignOutConfirm={(scope) => setSignOutScope(scope)}
              onOpenDeleteAlert={() => {
                setDeleteAlertOpen(true);
              }}
            />
          </TabsContent>
        </Tabs>

        {activeTab !== "security" && footerState && (
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
      <RestoreDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
      />
      <AlertDialog
        open={signOutScope !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSignOutScope(null);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{signOutCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription className="mt-2 text-left">
              {signOutCopy?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setSignOutScope(null)}
              disabled={isSigningOut}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              disabled={isSigningOut}
              className={cn(
                pressFeedback,
                signOutScope === "global" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {isSigningOut ? "Signing out..." : signOutCopy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogCancel
              onClick={() => setDeleteConfirmText("")}
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={
                deleteConfirmText.toLowerCase() !== user.email?.toLowerCase() ||
                isDeleting
              }
              className={cn(
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                pressFeedback,
              )}
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
