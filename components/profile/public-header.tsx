import type { User } from "@supabase/supabase-js";

import Link from "next/link";

import Logo from "~/components/layout/logo";
import { Button } from "~/components/ui/button";

interface PublicHeaderProps {
  user: User | null;
}

export async function PublicHeader({ user }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between py-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <Logo size={28} className="shrink-0" />
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Sheltermark
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Button variant="ghost" size="sm">
                <Link href="/login">Login</Link>
              </Button>

              <Button size="sm">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
