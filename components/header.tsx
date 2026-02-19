import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server";
import Logo from "./logo";
import { UserMenu } from "./user-menu";
import { WorkspaceMenu } from "./workspace/workspace-menu";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-4 mx-auto w-full">
      <div className="flex items-center gap-2">
        <Logo width={28} height={28} className="shrink-0" />
        <WorkspaceMenu />
      </div>
      <div className="flex items-center gap-2">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
