import Link from "next/link";
import { DemoBookmarkViewLazy } from "~/components/demo/demo-bookmark-view-lazy";
import { FeaturesSection } from "~/components/features-section";
import { Footer } from "~/components/footer";
import Logo from "~/components/logo";
import { Button } from "~/components/ui/button";
import { YCIcon } from "~/components/yc-icon";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-24">
        <div className="flex flex-col items-center mt-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 ">
            <YCIcon className="h-4 w-4" />
            <span className="text-foreground md:text-sm text-xs shrink-0 tracking-tight">
              NOT BACKED BY Y COMBINATOR
            </span>
          </span>

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

      <FeaturesSection />

      <Footer />
    </div>
  );
}
