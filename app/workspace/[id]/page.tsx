import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getWorkspaceTagsWithCount } from "~/app/action/tag.action";
import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/layout/header";
import { UserProvider } from "~/components/providers/user-context";
import { ShareDialogManager } from "~/components/share/share-dialog-manager";
import { requireAuth } from "~/lib/auth";
import { makeQueryClient } from "~/lib/query-client";
import { tagKeys } from "~/lib/query-keys";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;

  const queryClient = makeQueryClient();

  const { user } = await requireAuth();

  await queryClient.prefetchQuery({
    queryKey: tagKeys.byWorkspace(user.id, id),
    queryFn: async () => {
      const result = await getWorkspaceTagsWithCount(id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserProvider user={user}>
        <main className="min-h-dvh bg-background">
          <Header user={user} />
          <BookmarkView scope={{ type: "workspace", id }} />
          <ShareDialogManager />
        </main>
      </UserProvider>
    </HydrationBoundary>
  );
}
