import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getBookmarks } from "~/app/action/bookmark.action";
import { getTagsWithCount } from "~/app/action/tag.action";
import { getWorkspaceTagsWithCount } from "~/app/action/tag.action";
import { getWorkspaces } from "~/app/action/workspace.action";
import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/layout/header";
import { UserProvider } from "~/components/providers/user-context";
import { ShareDialogManager } from "~/components/share/share-dialog-manager";
import { requireAuth } from "~/lib/auth";
import { makeQueryClient } from "~/lib/query-client";
import { bookmarkKeys, tagKeys, workspaceKeys } from "~/lib/query-keys";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const queryClient = makeQueryClient();

  const [{ id }, { user }] = await Promise.all([params, requireAuth()]);

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: workspaceKeys.all(user.id),
      queryFn: async () => {
        const result = await getWorkspaces();
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: bookmarkKeys.all(user.id),
      queryFn: async () => {
        const result = await getBookmarks();
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: tagKeys.withCount(user.id),
      queryFn: async () => {
        const result = await getTagsWithCount();
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: tagKeys.byWorkspace(user.id, id),
      queryFn: async () => {
        const result = await getWorkspaceTagsWithCount(id);
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserProvider user={user}>
        <main className="flex h-dvh flex-col overflow-hidden bg-background">
          <Header />
          <BookmarkView scope={{ type: "workspace", id }} />
          <ShareDialogManager />
        </main>
      </UserProvider>
    </HydrationBoundary>
  );
}
