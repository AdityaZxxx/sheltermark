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
import { useProfile } from "~/hooks/use-profile";
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
  const { profile, isLoading } = useProfile();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account settings.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="general">
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

          <TabsContent value="general" className="pt-2">
            <SettingsGeneralTab
              user={user}
              onCancel={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent
            value="profile"
            className="pt-2 -mx-2 px-2 max-h-[60vh] overflow-y-auto"
          >
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading profile...
              </div>
            ) : (
              <SettingsProfileTab
                profile={profile ?? null}
                onCancel={() => onOpenChange(false)}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
