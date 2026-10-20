"use client";

import { GithubLogoIcon, GlobeIcon, XLogoIcon } from "@phosphor-icons/react";

import type { Profile } from "~/lib/schemas/profile.schema";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface PublicProfileSidebarProps {
  profile: Profile;
}

export function PublicProfileSidebar({ profile }: PublicProfileSidebarProps) {
  const displayName = profile.name || profile.username || "";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <Avatar className="size-24">
          <AvatarImage
            src={profile.avatar_url || undefined}
            alt={displayName}
          />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
      </div>

      <div className="text-left">
        <h1 className="text-2xl font-semibold">{displayName}</h1>
        <p className="text-muted-foreground text-sm">@{profile.username}</p>
      </div>

      {profile.bio && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {profile.bio}
        </p>
      )}

      <div className="flex justify-start gap-4 pt-3 border-t border-border/60">
        {profile.website_url && (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Website"
                />
              }
            >
              <GlobeIcon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>Website</TooltipContent>
          </Tooltip>
        )}
        {profile.github_url && (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href={profile.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                />
              }
            >
              <GithubLogoIcon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>GitHub</TooltipContent>
          </Tooltip>
        )}
        {profile.x_url && (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href={profile.x_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter)"
                />
              }
            >
              <XLogoIcon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>X (Twitter)</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
