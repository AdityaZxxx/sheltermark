import Link from "next/link";
import { DemoBookmarkViewLazy } from "~/components/demo/demo-bookmark-view-lazy";
import { Footer } from "~/components/footer";
import Logo from "~/components/logo";
import { Button } from "~/components/ui/button";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-24">
        <div className="flex flex-col items-center mt-8 text-center">
          <Logo size={64} className="mb-2" />
          <h1 className="text-4xl font-bold mb-8">Sheltermark</h1>
          <p className="text-base md:text-xl mb-8 text-center text-muted-foreground max-w-2xl">
            A clean, minimalist bookmark manager. Organize and access your
            bookmarks from anywhere.
          </p>
          <div className="flex gap-4">
            <Link href="/login">
              <Button size="lg" className="rounded-full px-8">
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" className="rounded-full px-8">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <DemoBookmarkViewLazy />
      </div>

      <Footer />
    </div>
  );
}
