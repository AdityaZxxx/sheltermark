import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { getBookmarks } from "~/app/action/bookmark.action";
import { getProfile } from "~/app/action/setting.action";
import { getWorkspaces } from "~/app/action/workspace.action";
import { ShareDialogManager } from "~/components/add/share-dialog-manager";
import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/header";
import { UserProvider } from "~/components/providers/user-context";
import { requireAuth } from "~/lib/auth";
import { makeQueryClient } from "~/lib/query-client";
import { bookmarkKeys, profileKeys, workspaceKeys } from "~/lib/query-keys";
import type { WorkspaceWithCount } from "~/lib/schemas/workspace.schema";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;
  const { user } = await requireAuth();

  const queryClient = makeQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: workspaceKeys.byUser(user?.id),
      queryFn: async () => {
        const result = await getWorkspaces();
        if (!result.success) throw new Error(result.error);
        return result.data as WorkspaceWithCount[];
      },
    }),
    queryClient.prefetchQuery({
      queryKey: bookmarkKeys.all,
      queryFn: async () => {
        const result = await getBookmarks();
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: profileKeys.byUser(user?.id),
      queryFn: async () => {
        const result = await getProfile();
        if (!result.success) throw new Error(result.error);
        return result.data?.profile ?? null;
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserProvider user={user}>
        <main className="min-h-dvh bg-background">
          <Header user={user} />
          <BookmarkView scope={{ type: "workspace", id }} />
          <Suspense>
            <ShareDialogManager />
          </Suspense>
        </main>
      </UserProvider>
    </HydrationBoundary>
  );
}
