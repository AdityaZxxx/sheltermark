import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { getBookmarks } from "~/app/action/bookmark";
import { getWorkspaces } from "~/app/action/workspace";
import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/header";
import { requireAuthSafe } from "~/lib/auth";
import { makeQueryClient } from "~/lib/query-client";

export default async function DashboardPage() {
  const { user } = await requireAuthSafe();

  if (!user) {
    return redirect("/login");
  }

  const queryClient = makeQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["workspaces"],
      queryFn: () => getWorkspaces(),
    }),
    queryClient.prefetchQuery({
      queryKey: ["bookmarks"],
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
