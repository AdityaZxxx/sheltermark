import { TentIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Footer } from "~/components/footer";
import { Button } from "~/components/ui/button";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col max-w-2xl mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-24">
        <div className="flex flex-col items-center mt-8">
          <TentIcon className="h-12 w-12 text-primary mb-4" />
          <h1 className="text-4xl font-bold mb-8">ShelterMark</h1>
          <p className="text-base md:text-xl mb-8 text-center text-muted-foreground max-w-2xl">
            A clean, minimalist bookmark manager. Sync across devices and share
            your collections.
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
      <Footer />
    </div>
  );
}
