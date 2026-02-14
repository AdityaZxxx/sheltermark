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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account settings.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" className="gap-2">
              <GearIcon className="size-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <UserIcon className="size-4" />
              Public Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
            <SettingsGeneralTab
              user={user}
              onCancel={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="profile" className="mt-4">
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
