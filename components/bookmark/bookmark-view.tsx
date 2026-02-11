"use client";

import { useState } from "react";
import { BookmarkCardItem } from "./bookmark-card-item";
import { BookmarkListItem } from "./bookmark-list-item";
import { BookmarkViewToggle } from "./bookmark-view-toggle";

const MOCK_BOOKMARKS = [
  {
    id: "1",
    url: "https://nextjs.org",
    title: "Next.js by Vercel - The React Framework",
    note: "Build fearless, full-stack web applications with the world's most popular React framework. Next.js is open source and used by the world's leading companies.",
    favicon_url: "https://nextjs.org/favicon.ico",
    og_image_url:
      "https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/4JmubmYDJnFtstwHbaZPev/0c3576832aae5b1a4d98c8c9f98863c3/Vercel_Home_OG.png",
    domain: "nextjs.org",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    url: "https://supabase.com",
    title: "Supabase | The Open Source Firebase Alternative",
    note: "Build in a weekend. Scale to billions. Supabase is an open source Firebase alternative. Start your project with a Postgres database, Authentication, instant APIs, Edge Functions, Realtime subscriptions, and Storage.",
    favicon_url: "https://supabase.com/favicon/apple-icon-57x57.png",
    og_image_url: "https://supabase.com/images/og/supabase-og.png",
    domain: "supabase.com",
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    url: "https://tailwindcss.com",
    title:
      "Tailwind CSS - Rapidly build modern websites without ever leaving your HTML.",
    note: "Tailwind CSS is a highly customizable, low-level CSS framework that gives you all of the building blocks you need to build bespoke designs without any annoying opinionated styles you have to fight to override.",
    favicon_url: "https://tailwindcss.com/favicons/favicon-32x32.png?v=4",
    og_image_url:
      "https://tailwindcss.com/opengraph-image.jpg?opengraph-image.c1dec83c.jpg",
    domain: "tailwindcss.com",
    created_at: new Date().toISOString(),
  },
  {
    id: "4",
    url: "https://github.com",
    title: "GitHub: Let’s build from here",
    note: "GitHub is where over 100 million developers shape the future of software, together. Contribute to the open source community, manage your repositories, build software from anywhere.",
    favicon_url: "https://github.githubassets.com/favicons/favicon.svg",
    og_image_url:
      "https://github.githubassets.com/images/modules/open_graph/github-logo.png",
    domain: "github.com",
    created_at: new Date().toISOString(),
  },
  {
    id: "5",
    url: "https://adxxya30.vercel.app",
    title: "Personal Website",
    note: "Aditya Rahmad",
    favicon_url: "https://adxxya30.vercel.app/favicon.ico",
    og_image_url:
      "https://adxxya30.vercel.app/og-image?title=Aditya+Rahmad+-+Developer+and+Tech+Enthusiast&url=%2F&description=Welcome+to+my+devsite%2C+here+you+can+find+my+projects%2C+blogs%2C+and+other+stuf.",
    domain: "adxxya30.vercel.app",
    created_at: new Date().toISOString(),
  },
];

export function BookmarkView() {
  const [view, setView] = useState<"list" | "card">("list");

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 md:px-6 space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">~/All Bookmarks</h2>
        </div>
        <BookmarkViewToggle view={view} onViewChange={setView} />
      </div>

      <div
        className={
          view === "card"
            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"
            : "flex flex-col gap-1"
        }
      >
        {MOCK_BOOKMARKS.map((bookmark) =>
          view === "card" ? (
            <BookmarkCardItem
              key={bookmark.id}
              title={bookmark.title}
              url={bookmark.url}
              created_at={bookmark.created_at}
              og_image_url={bookmark.og_image_url}
              favicon_url={bookmark.favicon_url}
              domain={bookmark.domain}
            />
          ) : (
            <BookmarkListItem
              key={bookmark.id}
              title={bookmark.title}
              url={bookmark.url}
              created_at={bookmark.created_at}
              favicon_url={bookmark.favicon_url}
              domain={bookmark.domain}
            />
          ),
        )}
      </div>
    </div>
  );
}
