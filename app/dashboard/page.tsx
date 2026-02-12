import { redirect } from "next/navigation";
import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/header";
import { requireAuth } from "~/lib/auth";

export default async function DashboardPage() {
  const { user } = await requireAuth();

  if (!user) {
    return redirect("/login");
  }

  return (
    <main className="min-h-dvh bg-background">
      <Header />
      <BookmarkView />
    </main>
  );
}
