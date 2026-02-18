import {
  ArrowArcLeftIcon,
  ArrowArcRightIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Markdown from "react-markdown";

export const metadata: Metadata = {
  title: "Terms of Service — Sheltermark",
  description: "Terms and conditions for using Sheltermark bookmark manager",
};

export default function TermsPage() {
  const content = readFileSync(
    join(process.cwd(), "app/terms/content.md"),
    "utf-8",
  );

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container max-w-3xl mx-auto px-4">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowArcLeftIcon className="h-4 w-4" />
          Back to home
        </Link>

        <div className="max-w-none">
          <Markdown
            components={{
              h1: ({ children }) => (
                <h1 className="mb-2 text-2xl sm:text-3xl font-semibold text-foreground">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-3 text-lg sm:text-xl font-medium text-foreground">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-4 text-base sm:text-lg font-medium text-foreground">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="mb-4 list-disc space-y-2 pl-6 text-muted-foreground">
                  {children}
                </ul>
              ),
              li: ({ children }) => (
                <li className="leading-relaxed">{children}</li>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">
                  {children}
                </strong>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-foreground underline hover:no-underline"
                >
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </Markdown>
          <Link
            href="/privacy"
            className="mt-8 flex justify-end items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            See Privacy Policy
            <ArrowArcRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
