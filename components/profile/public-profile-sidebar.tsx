"use client";

import { GithubLogoIcon, GlobeIcon, XLogoIcon } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";

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
        <h1 className="text-2xl font-bold">{displayName}</h1>
        <p className="text-muted-foreground">@{profile.username}</p>
      </div>

      {profile.bio && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {profile.bio}
        </p>
      )}

      <div className="flex justify-start">
        {profile.website_url && (
          <a
            href={profile.website_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Website"
          >
            <Button variant="ghost" size="icon">
              <GlobeIcon className="h-4 w-4" />
            </Button>
          </a>
        )}
        {profile.github_url && (
          <a
            href={profile.github_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <Button variant="ghost" size="icon">
              <GithubLogoIcon className="h-4 w-4" />
            </Button>
          </a>
        )}
        {profile.x_url && (
          <a
            href={profile.x_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
          >
            <Button variant="ghost" size="icon">
              <XLogoIcon className="h-4 w-4" />
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
