"use client";

import type { User } from "@supabase/supabase-js";

import {
  ArchiveIcon,
  CaretUpDownIcon,
  GearIcon,
  MailboxIcon,
  RssIcon,
  SignOutIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { logout } from "~/app/action/logout.action";
import { FeedManager } from "~/components/feed/feed-manager";
import { ThemeMode } from "~/components/layout/theme-mode";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useProfile } from "~/hooks/use-profile";

import { Button } from "../ui/button";
import { ShortcutButton } from "./keyboard-shortcuts-dialog";
import { SettingsDialog } from "./setting-dialog";

interface UserMenuProps {
  user: User;
}

type BackupOutcome = "ok" | "denied" | "failed" | "invalid" | "unconfigured";

/**
 * Read the OAuth round-trip outcome from the URL once, at mount. Returns
 * null on normal loads (or during SSR, where window is unavailable) —
 * Settings stays closed in that case.
 */
function readBackupOutcome(): BackupOutcome | null {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- standard Next.js SSR guard
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("settings") !== "backup") return null;
  const raw = params.get("backup");
  if (
    raw === "ok" ||
    raw === "denied" ||
    raw === "failed" ||
    raw === "invalid" ||
    raw === "unconfigured"
  ) {
    return raw;
  }
  return "ok";
}

export function UserMenu({ user }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();
  const [backupOutcome] = useState(readBackupOutcome);
  // Open Settings automatically only when the OAuth round-trip returns.
  const [settingsOpen, setSettingsOpen] = useState(backupOutcome !== null);
  const [feedsOpen, setFeedsOpen] = useState(false);
  const { profile } = useProfile();

  // Cloud Backup OAuth round-trip lands on /dashboard with ?settings=backup
  // (+ &backup=ok|denied|…). State is derived at mount; this effect only
  // clears the consumed params and reports the outcome.
  useEffect(() => {
    if (backupOutcome === null) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("settings");
    params.delete("backup");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
    if (backupOutcome === "ok") {
      toast.success("Cloud backup connected");
    } else {
      const messages = {
        denied: "Cloud backup was not authorized.",
        failed: "Could not connect the provider. Try again.",
        invalid: "The authorization link expired. Try again.",
        unconfigured: "This provider is not configured yet.",
      } as const;
      toast.error(messages[backupOutcome] ?? "Cloud backup failed.");
    }
  }, [backupOutcome]);

  if (!profile) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="gap-2 rounded-md h-auto px-2 py-1.5"
            >
              <Avatar>
                <AvatarImage
                  src={profile.avatar_url ?? undefined}
                  alt={profile.name ?? ""}
                />
                <AvatarFallback>
                  {profile.name?.charAt(0).toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm hidden md:block">{profile.name}</span>
              <CaretUpDownIcon className="h-4 w-4 hidden md:block" />
            </Button>
          }
        />
        <DropdownMenuContent
          className="rounded-lg w-42"
          align="end"
          sideOffset={8}
        >
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

          {profile.is_public && (
            <DropdownMenuItem className="w-full">
              <Link
                href={`/u/${profile.username}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="w-full flex items-center gap-2">
                  <UserCircleIcon className="h-4 w-4" /> Public Profile
                </span>
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => setFeedsOpen(true)}
            className="w-full"
          >
            <span className="w-full flex items-center gap-2">
              <RssIcon className="h-4 w-4" /> Subscriptions
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem className="w-full">
            <span className="w-full flex items-center gap-2">
              <ShortcutButton />
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="w-full"
            onClick={() => {
              window.open(
                "mailto:adityaofficial7142gmail.com",
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            <span className="w-full flex items-center gap-2">
              <MailboxIcon className="h-4 w-4" /> Send Feedback
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem className="w-full">
            <Link href="/trash" className="w-full">
              <span className="w-full flex items-center gap-2">
                <ArchiveIcon className="h-4 w-4" /> Trash
              </span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            className="w-full"
            disabled={isPending}
            nativeButton
            render={(props) => (
              <button
                {...props}
                type="button"
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

      <FeedManager open={feedsOpen} onOpenChange={setFeedsOpen} />
    </>
  );
}
