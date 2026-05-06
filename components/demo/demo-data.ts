import type { Bookmark } from "~/lib/schemas/bookmark.schema";
import type { Tag } from "~/lib/schemas/tag.schema";
import type { Workspace } from "~/lib/schemas/workspace.schema";

export const DEMO_WORKSPACES: Pick<
  Workspace,
  "id" | "name" | "is_public" | "is_default"
>[] = [
  { id: "personal", name: "Personal", is_public: false, is_default: true },
  { id: "work", name: "Work", is_public: true, is_default: false },
];

export const DEMO_TAGS: Tag[] = [
  {
    id: "tag-dev",
    user_id: "demo",
    name: "dev",
    created_at: new Date().toISOString(),
  },
  {
    id: "tag-social",
    user_id: "demo",
    name: "social",
    created_at: new Date().toISOString(),
  },
  {
    id: "tag-video",
    user_id: "demo",
    name: "video",
    created_at: new Date().toISOString(),
  },
  {
    id: "tag-learning",
    user_id: "demo",
    name: "learning",
    created_at: new Date().toISOString(),
  },
  {
    id: "tag-design",
    user_id: "demo",
    name: "design",
    created_at: new Date().toISOString(),
  },
  {
    id: "tag-ui",
    user_id: "demo",
    name: "ui",
    created_at: new Date().toISOString(),
  },
  {
    id: "tag-productivity",
    user_id: "demo",
    name: "productivity",
    created_at: new Date().toISOString(),
  },
  {
    id: "tag-database",
    user_id: "demo",
    name: "database",
    created_at: new Date().toISOString(),
  },
];

export type DemoBookmark = Pick<
  Bookmark,
  | "id"
  | "url"
  | "title"
  | "favicon_url"
  | "og_image_url"
  | "workspace_id"
  | "created_at"
  | "note"
  | "is_broken"
  | "broken_status"
  | "http_status"
  | "last_checked_at"
>;

export const INITIAL_DEMO_BOOKMARKS: DemoBookmark[] = [
  {
    id: "p1",
    title: "GitHub",
    url: "https://github.com",
    favicon_url: "https://github.githubassets.com/favicons/favicon.svg",
    og_image_url:
      "https://images.ctfassets.net/8aevphvgewt8/4pe4eOtUJ0ARpZRE4fNekf/f52b1f9c52f059a33170229883731ed0/GH-Homepage-Universe-img.png",
    workspace_id: "personal",
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    note: "Starred repos to review for the next sprint — check trending and explore community highlights",
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
  {
    id: "p2",
    title: "X",
    url: "https://x.com",
    favicon_url:
      "https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png",
    og_image_url: "https://abs.twimg.com/rweb/ssr/default/v2/og/image.png",
    workspace_id: "personal",
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    note: null,
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
  {
    id: "p3",
    title: "YouTube — Tech Talks",
    url: "https://youtube.com",
    favicon_url:
      "https://www.youtube.com/s/desktop/78e11dee/img/favicon_32x32.png",
    og_image_url: "https://www.youtube.com/img/desktop/yt_1200.png",
    workspace_id: "personal",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    note: "Conference recordings and deep-dive engineering talks — great for background learning during deep work sessions",
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
  {
    id: "w1",
    title: "Figma",
    url: "https://figma.com",
    favicon_url: "https://static.figma.com/app/icon/2/touch-76.png",
    og_image_url:
      "https://cdn.sanity.io/images/599r6htc/regionalized/1adfa5a99040c80af7b4b5e3e2cf845315ea2367-2400x1260.png?w=1200&q=70&fit=max&auto=format",
    workspace_id: "work",
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    note: "Design system components and brand assets library — keep this synced with the marketing site",
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
  {
    id: "w2",
    title: "Notion",
    url: "https://notion.com",
    favicon_url: "https://notion.com/front-static/logo-ios.png",
    og_image_url: "https://www.notion.com/front-static/meta/mwn-og-image.png",
    workspace_id: "work",
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    note: null,
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
  {
    id: "w3",
    title: "Linear",
    url: "https://linear.app",
    favicon_url: "https://liner.com/favicon.ico?v=20250605",
    og_image_url: "https://assets.getliner.com/web/og_image.jpg",
    workspace_id: "work",
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    note: "Sprint planning board and project tracking — review blockers before standup",
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
  {
    id: "w4",
    title: "Vercel",
    url: "https://vercel.com",
    favicon_url:
      "https://assets.vercel.com/image/upload/q_auto/front/favicon/vercel/apple-touch-icon-57x57.png",
    og_image_url:
      "https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/4JmubmYDJnFtstwHbaZPev/0c3576832aae5b1a4d98c8c9f98863c3/Vercel_Home_OG.png",
    workspace_id: "work",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    note: "Recent deployment pipeline changes — need to update team documentation for the new preview URLs",
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
  {
    id: "w5",
    title: "Supabase",
    url: "https://supabase.com",
    favicon_url: "https://supabase.com/favicon/favicon.ico",
    og_image_url: "https://supabase.com/images/og/supabase-og.png",
    workspace_id: "work",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    note: "Project backend infrastructure — database migrations, realtime subscriptions, and edge functions reference",
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
];

export const TAGS_BY_BOOKMARK_ID: Record<string, string[]> = {
  p1: ["tag-dev"],
  p2: ["tag-social"],
  p3: ["tag-video", "tag-learning"],
  p4: ["tag-dev"],
  w1: ["tag-design", "tag-ui"],
  w2: ["tag-productivity"],
  w3: ["tag-dev", "tag-productivity"],
  w4: ["tag-dev"],
  w5: ["tag-dev", "tag-database"],
};

export function getBookmarkTags(bookmarkId: string): Tag[] {
  const tagIds = TAGS_BY_BOOKMARK_ID[bookmarkId] ?? [];
  return tagIds
    .map((id) => DEMO_TAGS.find((t) => t.id === id))
    .filter((t): t is Tag => t !== undefined);
}
