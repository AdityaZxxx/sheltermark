"use client";

import { GearIcon, UserIcon } from "@phosphor-icons/react";
import type { User } from "@supabase/supabase-js";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[95vh]">
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
            className="flex-1 overflow-y-auto -mx-2 px-2 my-6"
          >
            <SettingsGeneralTab
              user={user}
              onCancel={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent
            value="profile"
            className="flex-1 overflow-y-auto -mx-2 px-2 my-6"
          >
            <SettingsProfileTab onCancel={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
