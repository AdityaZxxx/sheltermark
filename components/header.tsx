import { redirect } from "next/navigation";
import { requireAuth } from "~/lib/auth";
import Logo from "./logo";
import { UserMenu } from "./settings/user-menu";
import { WorkspaceMenu } from "./workspace/workspace-menu";

export async function Header() {
  const { user } = await requireAuth();

  if (!user) {
    redirect("/login");
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-6 py-4 mx-auto w-full bg-background">
      <div className="flex items-center gap-2">
        <Logo size={28} className="shrink-0" />
        <WorkspaceMenu />
      </div>
      <div className="flex items-center gap-2">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
