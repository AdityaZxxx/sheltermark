"use client";

import { UserMenu } from "../settings/user-menu";
import { WorkspaceMenu } from "../workspace/workspace-menu";
import Logo from "./logo";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full shrink-0 bg-background">
      <div className="mx-auto flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-2">
          <Logo size={28} className="shrink-0" />
          <WorkspaceMenu />
        </div>
        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
