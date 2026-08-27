import Image from "next/image";
import Link from "next/link";

import { Hero } from "~/components/landing/hero";
import { Reveal } from "~/components/landing/lib";
import { StorySections } from "~/components/landing/story-sections";
import { Footer } from "~/components/layout/footer";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background font-sans text-foreground antialiased">
      <nav className="sticky top-0 z-10 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Sheltermark"
              width={20}
              height={20}
              className="invert dark:invert-0"
            />
            <span className="text-sm font-semibold">Sheltermark</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.96]"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <Hero />

        <StorySections />

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <div className="rounded-2xl bg-primary px-8 py-16 text-center">
                <h2 className="mx-auto max-w-md text-3xl tracking-tighter text-balance text-primary-foreground">
                  Your links deserve better than a browser bar.
                </h2>
                <Link
                  href="/signup"
                  className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-background px-6 text-sm font-semibold text-foreground transition-transform active:scale-[0.96]"
                >
                  Get started
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <div className="border-t border-border">
        <Footer />
      </div>
    </div>
  );
}
