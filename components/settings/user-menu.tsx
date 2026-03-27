"use client";

import {
  CaretUpDownIcon,
  GearIcon,
  SignOutIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useState, useTransition } from "react";
import { logout } from "~/app/action/login";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useProfile } from "~/hooks/use-profile";
import { ThemeMode } from "../theme-mode";
import { Button } from "../ui/button";
import { SettingsDialog } from "./setting-dialog";

interface UserMenuProps {
  user: User;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { profile } = useProfile();

  if (!profile) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar>
                <AvatarImage
                  src={profile.avatar_url ?? undefined}
                  alt={profile.name ?? undefined}
                />
                <AvatarFallback>
                  {profile.name?.charAt(0).toUpperCase() ?? undefined}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm hidden md:block">{profile.name}</span>
              <CaretUpDownIcon className="h-4 w-4 hidden md:block" />
            </Button>
          }
        />
        <DropdownMenuContent className="rounded-xl" align="end" sideOffset={8}>
          <ThemeMode variant="tabs" />
          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            onClick={() => setSettingsOpen(true)}
            className="w-full"
          >
            <span className="w-full flex items-center gap-2">
              <GearIcon className="h-4 w-4" /> Settings
            </span>
          </DropdownMenuItem>
          {profile?.is_public && (
            <DropdownMenuItem className="w-full">
              <Link href={`/u/${profile?.username}`}>
                <span className="w-full flex items-center gap-2">
                  <UserCircleIcon className="h-4 w-4" /> Public Profile
                </span>
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            className="w-full"
            disabled={isPending}
            nativeButton
            render={(props) => (
              <button
                {...props}
                disabled={isPending}
                onClick={(e) => {
                  props.onClick?.(e);
                  startTransition(async () => {
                    await logout();
                  });
                }}
              >
                <SignOutIcon className="h-4 w-4" />
                {isPending ? "Logging out..." : "Log out"}
              </button>
            )}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={user}
      />
    </>
  );
}
