"use client";

import {
  CaretUpDownIcon,
  GearIcon,
  LaptopIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import type { User } from "@supabase/supabase-js";
import { useTheme } from "next-themes";
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
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useProfile } from "~/hooks/use-profile";
import { SettingsDialog } from "./settings-dialog";
import { Button } from "./ui/button";

interface UserMenuProps {
  user: User;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { profile } = useProfile();

  const fullName = profile?.full_name || user.user_metadata.full_name;
  const avatarUrl = profile?.avatar_url || user.user_metadata.avatar_url;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={avatarUrl} alt={fullName} />
                <AvatarFallback>
                  {fullName.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <h1 className="text-sm font-medium leading-none hidden md:block">
                {fullName}
              </h1>
              <CaretUpDownIcon className="h-4 w-4 hidden md:block" />
            </Button>
          }
        />
        <DropdownMenuContent className="rounded-xl" align="end" sideOffset={8}>
          <ThemeTabs />

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

function ThemeTabs() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="p-1.5">
      <Tabs value={theme} onValueChange={(v) => setTheme(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/60 rounded-lg p-1">
          <TabsTrigger
            value="light"
            className="rounded-md data-active:bg-foreground! data-active:shadow-sm data-active:text-primary-foreground!"
          >
            <SunIcon className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger
            value="dark"
            className="rounded-md data-active:bg-foreground! data-active:shadow-sm data-active:text-primary-foreground!"
          >
            <MoonIcon className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger
            value="system"
            className="rounded-md data-active:bg-foreground! data-active:shadow-sm data-active:text-primary-foreground!"
          >
            <LaptopIcon className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
