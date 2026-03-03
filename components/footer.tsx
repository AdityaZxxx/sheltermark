import Link from "next/link";
import { ThemeMode } from "./theme-mode";

export function Footer() {
  return (
    <footer className="mb-10 mt-10 px-2 text-center text-sm text-muted-foreground sm:mb-12 sm:mt-12">
      <div className="mb-4 flex flex-wrap gap-4  flex-row items-center justify-center">
        <div className="">
          <ThemeMode variant="rounding" size="sm" />
        </div>
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>

        <Link href="/privacy" className=" hover:underline">
          Privacy Policy
        </Link>
      </div>
      <p>
        © {new Date().getFullYear()} Sheltermark - Safe place for your bookmarks
      </p>
    </footer>
  );
}
