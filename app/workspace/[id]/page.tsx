import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { getWorkspaces } from "~/app/action/workspace.action";
import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/layout/header";
import { UserProvider } from "~/components/providers/user-context";
import { ShareDialogManager } from "~/components/share/share-dialog-manager";
import { requireAuth } from "~/lib/auth";
import { makeQueryClient } from "~/lib/query-client";
import { workspaceKeys } from "~/lib/query-keys";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;
  const { user } = await requireAuth();

  const queryClient = makeQueryClient();

  // Prefetch only the workspace list (the shell's navigation menu) on the
  // server so the menu is never blank on a direct visit. Everything else
  // (bookmarks, tags, profile) is fetched fresh by the client on the frame.
  await queryClient.prefetchQuery({
    queryKey: workspaceKeys.byUser(user?.id),
    queryFn: async () => {
      const result = await getWorkspaces();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserProvider user={user}>
        <main className="min-h-dvh bg-background">
          <Header user={user} />
          <Suspense>
            <BookmarkView scope={{ type: "workspace", id }} />
          </Suspense>
          <Suspense>
            <ShareDialogManager />
          </Suspense>
        </main>
      </UserProvider>
    </HydrationBoundary>
  );
}
