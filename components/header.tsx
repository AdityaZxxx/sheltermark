import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Logo from "./logo";
import { UserMenu } from "./settings/user-menu";
import { WorkspaceMenu } from "./workspace/workspace-menu";

interface HeaderProps {
  user: User;
}

export async function Header({ user }: HeaderProps) {
  if (!user) {
    redirect("/login");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-2">
          <Logo size={28} className="shrink-0" />
          <WorkspaceMenu />
        </div>
        <div className="flex items-center gap-2">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
