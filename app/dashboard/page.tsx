import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { getBookmarks } from "~/app/action/bookmark";
import { getWorkspaces } from "~/app/action/workspace";
import { ShareDialogManager } from "~/components/add/share-dialog-manager";
import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/header";
import { requireAuth } from "~/lib/auth";
import { makeQueryClient } from "~/lib/query-client";
import { bookmarkKeys, workspaceKeys } from "~/lib/query-keys";

export default async function DashboardPage() {
  const { user } = await requireAuth();

  const queryClient = makeQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: workspaceKeys.byUser(user?.id),
      queryFn: () => getWorkspaces(),
    }),
    queryClient.prefetchQuery({
      queryKey: bookmarkKeys.all,
      queryFn: async () => {
        const result = await getBookmarks();
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="min-h-dvh bg-background">
        <Header />
        <BookmarkView />
        <Suspense>
          <ShareDialogManager />
        </Suspense>
      </main>
    </HydrationBoundary>
  );
}
