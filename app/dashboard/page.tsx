import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { getBookmarks } from "~/app/action/bookmark.action";
import { getProfile } from "~/app/action/setting.action";
import { getWorkspaces } from "~/app/action/workspace.action";
import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/layout/header";
import { UserProvider } from "~/components/providers/user-context";
import { ShareDialogManager } from "~/components/share/share-dialog-manager";
import { requireAuth } from "~/lib/auth";
import { makeQueryClient } from "~/lib/query-client";
import { bookmarkKeys, profileKeys, workspaceKeys } from "~/lib/query-keys";

export default async function DashboardPage() {
  const { user } = await requireAuth();

  const queryClient = makeQueryClient();

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
      queryKey: profileKeys.all(user.id),
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
          <BookmarkView scope={{ type: "global" }} />
          <Suspense>
            <ShareDialogManager />
          </Suspense>
        </main>
      </UserProvider>
    </HydrationBoundary>
  );
}
