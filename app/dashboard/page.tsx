import { redirect } from "next/navigation";
import { BookmarkView } from "~/components/bookmark/bookmark-view";
import { Header } from "~/components/header";
import { requireAuthSafe } from "~/lib/auth";

export default async function DashboardPage() {
  const { user } = await requireAuthSafe();

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
