"use client";

import { GearIcon, UserIcon } from "@phosphor-icons/react";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { ExportDialog } from "~/components/import-export/export-dialog";
import { ImportDialog } from "~/components/import-export/import-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { SettingsGeneralTab } from "./settings-general-tab";
import { SettingsProfileTab } from "./settings-profile-tab";

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
  const isChildDialogOpen = exportDialogOpen || importDialogOpen;

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
    </Dialog>
  );
}
