import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server";
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
      <div className="flex items-center gap-4">
        <span className="text-xl font-bold hidden md:block">ShelterMark</span>
        <WorkspaceMenu />
      </div>
      <div className="flex items-center gap-4">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
