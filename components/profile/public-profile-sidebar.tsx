"use client";

import { GithubLogoIcon, GlobeIcon, XLogoIcon } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

interface PublicProfileSidebarProps {
  profile: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    github_url: string | null;
    x_url: string | null;
    website_url: string | null;
    created_at: string;
  };
}

export function PublicProfileSidebar({ profile }: PublicProfileSidebarProps) {
  const displayName = profile.full_name || profile.username;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <Avatar className="h-24 w-24">
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

      <div className="flex justify-start gap-4">
        {profile.website_url && (
          <a
            href={profile.website_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Website"
          >
            <GlobeIcon className="h-4 w-4" />
          </a>
        )}
        {profile.github_url && (
          <a
            href={profile.github_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <GithubLogoIcon className="h-4 w-4" />
          </a>
        )}
        {profile.x_url && (
          <a
            href={profile.x_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
          >
            <XLogoIcon className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
