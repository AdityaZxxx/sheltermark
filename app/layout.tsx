import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { QueryProvider } from "~/components/providers/query-provider";
import { SupabaseProvider } from "~/components/providers/supabase-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sheltermark — Safe place for your bookmarks",
  description:
    "A clean, minimalist bookmark manager. Organize and access your bookmarks from anywhere.",
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
