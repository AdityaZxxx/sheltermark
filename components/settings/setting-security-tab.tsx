"use client";

import { GlobeIcon, SignOutIcon, TrashIcon } from "@phosphor-icons/react";

import { Button } from "~/components/ui/button";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "~/components/ui/field";
import { cn } from "~/lib/utils";

export type RemoteSignOutScope = "others" | "global";

// Press feedback per the app's motion language: exact transition
// properties (hover bg/text + press scale), never transition-all.
export const pressFeedback =
  "transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96]";

interface SettingsSecurityTabProps {
  onOpenSignOutConfirm: (scope: RemoteSignOutScope) => void;
  onOpenDeleteAlert: () => void;
}

export function SettingsSecurityTab({
  onOpenSignOutConfirm,
  onOpenDeleteAlert,
}: SettingsSecurityTabProps) {
  return (
    <FieldGroup className="scroll-fade flex-1 overflow-y-auto px-4 py-4">
      <FieldSet>
        <FieldLegend variant="label">Device Sessions</FieldLegend>
        <FieldDescription>
          Each device signs in independently. Logging out here doesn't affect
          your other devices. Use these to end sessions you left behind
          elsewhere.
        </FieldDescription>
        <div className="mt-2 flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("justify-start gap-2", pressFeedback)}
            onClick={() => onOpenSignOutConfirm("others")}
          >
            <SignOutIcon className="size-4" />
            Sign out other devices
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className={cn("justify-start gap-2", pressFeedback)}
            onClick={() => onOpenSignOutConfirm("global")}
          >
            <GlobeIcon className="size-4" />
            Sign out everywhere
          </Button>
        </div>
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend variant="label">Danger Zone</FieldLegend>
        <FieldDescription>
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </FieldDescription>
        <Button
          variant="destructive"
          size="sm"
          className={cn("mt-2 justify-start gap-2", pressFeedback)}
          onClick={onOpenDeleteAlert}
        >
          <TrashIcon className="size-4" />
          Delete Account
        </Button>
      </FieldSet>
    </FieldGroup>
  );
}
