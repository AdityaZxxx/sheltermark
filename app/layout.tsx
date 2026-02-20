import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { QueryProvider } from "~/components/providers/query-provider";
import { SupabaseProvider } from "~/components/providers/supabase-provider";
import { getBaseUrl } from "~/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  title: "Sheltermark — Safe place for your bookmarks",
  description:
    "A clean, minimalist bookmark manager. Organize and access your bookmarks from anywhere.",
  metadataBase: new URL(baseUrl),
  keywords: ["bookmarks", "manager", "minimalist", "productivity", "organize"],
  authors: [{ name: "Aditya Rahmad" }],
  openGraph: {
    title: "Sheltermark — Safe place for your bookmarks",
    description:
      "A clean, minimalist bookmark manager. Organize and access your bookmarks from anywhere.",
    url: baseUrl,
    siteName: "Sheltermark",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Sheltermark - Bookmark Manager",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sheltermark — Safe place for your bookmarks",
    description:
      "A clean, minimalist bookmark manager. Organize and access your bookmarks from anywhere.",
    images: ["/api/og"],
  },
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [
      { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
    shortcut: ["/logo.svg"],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        <NuqsAdapter>
          <SupabaseProvider>
            <QueryProvider>{children}</QueryProvider>
          </SupabaseProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
