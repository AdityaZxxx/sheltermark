import Link from "next/link";

export function Footer() {
  return (
    <footer className="mb-10 mt-10 px-2 text-center text-sm text-muted-foreground sm:mb-12 sm:mt-12">
      <div className="mb-4 flex flex-wrap gap-4  flex-row items-center justify-center">
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>

        <Link href="/privacy" className=" hover:underline">
          Privacy Policy
        </Link>
      </div>
      <p>
        © {new Date().getFullYear()} sheltermark - Safe place for your bookmarks
      </p>
    </footer>
  );
}
