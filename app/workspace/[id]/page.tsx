import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/layout/header";
import { UserProvider } from "~/components/providers/user-context";
import { ShareDialogManager } from "~/components/share/share-dialog-manager";
import { requireAuth } from "~/lib/auth";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;
  const { user } = await requireAuth();

  return (
    <UserProvider user={user}>
      <main className="min-h-dvh bg-background">
        <Header user={user} />
        <BookmarkView scope={{ type: "workspace", id }} />
        <ShareDialogManager />
      </main>
    </UserProvider>
  );
}
