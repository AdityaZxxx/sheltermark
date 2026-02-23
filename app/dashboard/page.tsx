import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getBookmarks } from "~/app/action/bookmark";
import { getWorkspaces } from "~/app/action/workspace";
import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/header";
import { requireAuth } from "~/lib/auth";
import { makeQueryClient } from "~/lib/query-client";

export default async function DashboardPage() {
  const { user } = await requireAuth();

  const queryClient = makeQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["workspaces", user?.id],
      queryFn: () => getWorkspaces(),
    }),
    queryClient.prefetchQuery({
      queryKey: ["bookmarks", user?.id],
      queryFn: async () => {
        const { data, error } = await getBookmarks();
        if (error) throw new Error(error);
        return data;
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="min-h-dvh bg-background">
        <Header />
        <BookmarkView />
      </main>
    </HydrationBoundary>
  );
}
