import type { Bookmark } from "~/types/bookmark.types";
import type { Workspace } from "~/types/workspace.types";

export const DEMO_WORKSPACES: Workspace[] = [
  { id: "personal", name: "Personal", is_public: false, is_default: true },
  { id: "work", name: "Work", is_public: true, is_default: false },
];

export const INITIAL_DEMO_BOOKMARKS: Bookmark[] = [
  {
    id: "p1",
    title: "GitHub",
    url: "https://github.com",
    favicon_url: "https://github.githubassets.com/favicons/favicon.svg",
    og_image_url:
      "https://images.ctfassets.net/8aevphvgewt8/4pe4eOtUJ0ARpZRE4fNekf/f52b1f9c52f059a33170229883731ed0/GH-Homepage-Universe-img.png",
    domain: "github.com",
    workspace_id: "personal",
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: "p2",
    title: "X",
    url: "https://x.com",
    favicon_url:
      "https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png",
    og_image_url: "https://abs.twimg.com/rweb/ssr/default/v2/og/image.png",
    domain: "x.com",
    workspace_id: "personal",
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "p3",
    title: "YouTube",
    url: "https://youtube.com",
    favicon_url:
      "https://www.youtube.com/s/desktop/78e11dee/img/favicon_32x32.png",
    og_image_url: "https://www.youtube.com/img/desktop/yt_1200.png",
    domain: "youtube.com",
    workspace_id: "personal",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "w1",
    title: "Figma",
    url: "https://figma.com",
    favicon_url: "https://static.figma.com/app/icon/2/touch-76.png",
    og_image_url:
      "https://cdn.sanity.io/images/599r6htc/regionalized/1adfa5a99040c80af7b4b5e3e2cf845315ea2367-2400x1260.png?w=1200&q=70&fit=max&auto=format",
    domain: "figma.com",
    workspace_id: "work",
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: "w2",
    title: "Notion",
    url: "https://notion.com",
    favicon_url: "https://notion.com/front-static/logo-ios.png",
    og_image_url: "https://www.notion.com/front-static/meta/mwn-og-image.png",
    domain: "notion.com",
    workspace_id: "work",
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: "w3",
    title: "Linear",
    url: "https://linear.app",
    favicon_url: "https://liner.com/favicon.ico?v=20250605",
    og_image_url: "https://assets.getliner.com/web/og_image.jpg",
    domain: "linear.app",
    workspace_id: "work",
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: "w4",
    title: "Vercel",
    url: "https://vercel.com",
    favicon_url:
      "https://assets.vercel.com/image/upload/q_auto/front/favicon/vercel/apple-touch-icon-57x57.png",
    og_image_url:
      "https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/4JmubmYDJnFtstwHbaZPev/0c3576832aae5b1a4d98c8c9f98863c3/Vercel_Home_OG.png",
    domain: "vercel.com",
    workspace_id: "work",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "w5",
    title: "Supabase",
    url: "https://supabase.com",
    favicon_url: "https://supabase.com/favicon/favicon.ico",
    og_image_url: "https://supabase.com/images/og/supabase-og.png",
    domain: "supabase.com",
    workspace_id: "work",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];
