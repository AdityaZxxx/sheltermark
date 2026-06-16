import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
  getTrashedBookmarks,
  getTrashedWorkspaces,
} from "~/app/action/trash.action";
import { Header } from "~/components/header";
import { UserProvider } from "~/components/providers/user-context";
import { TrashView } from "~/components/trash/trash-view";
import { requireAuth } from "~/lib/auth";
import { makeQueryClient } from "~/lib/query-client";
import { trashKeys } from "~/lib/query-keys";
import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { TrashedWorkspace } from "~/lib/schemas/workspace.schema";

export default async function TrashPage() {
  const { user } = await requireAuth();

  const queryClient = makeQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: trashKeys.bookmarks,
      queryFn: async () => {
        const result = await getTrashedBookmarks();
        if (!result.success) throw new Error(result.error);
        return result.data as Bookmark[];
      },
    }),
    queryClient.prefetchQuery({
      queryKey: trashKeys.workspaces,
      queryFn: async () => {
        const result = await getTrashedWorkspaces();
        if (!result.success) throw new Error(result.error);
        return result.data as TrashedWorkspace[];
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserProvider user={user}>
        <main className="min-h-dvh bg-background">
          <Header user={user} />
          <TrashView />
        </main>
      </UserProvider>
    </HydrationBoundary>
  );
}
