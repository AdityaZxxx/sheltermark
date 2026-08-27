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

const DAY = 86_400_000;

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

export const INITIAL_DEMO_BOOKMARKS: DemoBookmark[] = [
  {
    id: "p1",
    title: "GitHub - TanStack/query: Powerful async state management",
    url: "https://github.com/TanStack/query",
    favicon_url: "https://github.githubassets.com/favicons/favicon.svg",
    og_image_url:
      "https://repository-images.githubusercontent.com/160028566/af47dcc0-2b8a-4a0c-bf47-9f7d0b4db75f",
    workspace_id: "personal",
    created_at: ago(21 * DAY),
    note: "The async state library our site ships on — Query patterns to review before the next sprint",
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
  {
    id: "w1",
    title: "Material 3 Design Kit | Figma",
    url: "https://www.figma.com/community/file/1035203688168086460",
    favicon_url: "https://static.figma.com/app/icon/2/touch-76.png",
    og_image_url:
      "https://s3-alpha.figma.com/hub/file/2355352080793697665/127be774-4405-4a91-9ff7-72af3aa089cf-cover.png",
    workspace_id: "work",
    created_at: ago(14 * DAY),
    note: "Reference for the component library — keep tokens in sync with the marketing site",
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
  {
    id: "w4",
    title: "How we build software at Companies - a YouTube talk",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    favicon_url:
      "https://www.youtube.com/s/desktop/78e11dee/img/favicon_32x32.png",
    og_image_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    workspace_id: "work",
    created_at: ago(2 * DAY),
    note: "Great talk on how teams structure their shipping workflow — rewatch before the offsite",
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
  {
    id: "w5",
    title: "Database | Supabase Docs",
    url: "https://supabase.com/docs/guides/database",
    favicon_url: "https://supabase.com/favicon/favicon.ico",
    og_image_url:
      "https://obuldanrptloktxcffvn.supabase.co/functions/v1/og-images?site=docs&type=database&title=Database",
    workspace_id: "work",
    created_at: ago(7 * DAY),
    note: "Backend reference — migrations, realtime, and edge functions",
    is_broken: false,
    broken_status: "alive",
    http_status: null,
    last_checked_at: null,
  },
];

const TAGS_BY_BOOKMARK_ID = new Map<string, readonly string[]>([
  ["p1", ["tag-dev"]],
  ["p2", ["tag-social"]],
  ["p3", ["tag-video", "tag-learning"]],
  ["p4", ["tag-dev"]],
  ["w1", ["tag-design", "tag-ui"]],
  ["w2", ["tag-productivity"]],
  ["w3", ["tag-dev", "tag-productivity"]],
  ["w4", ["tag-dev"]],
  ["w5", ["tag-dev", "tag-database"]],
]);

export function getBookmarkTags(bookmarkId: string): Tag[] {
  const tagIds = TAGS_BY_BOOKMARK_ID.get(bookmarkId) ?? [];
  return tagIds
    .map((id) => DEMO_TAGS.find((t) => t.id === id))
    .filter((t): t is Tag => t !== undefined);
}

export function getDemoBookmark(id: string): DemoBookmark {
  return INITIAL_DEMO_BOOKMARKS.find((bookmark) => bookmark.id === id)!;
}

export const DEMO_STORY_HERO = {
  id: "story-hero",
  url: "https://kreate.gg",
  title: "Kreate — Your content is valuable.",
  favicon: "https://kreate.gg/apple-touch-icon.png",
  createdAt: "2026-08-26T09:00:00.000Z",
};

export const DEMO_STORY_CONTEXT = [
  {
    id: "c-arch",
    title: "General Recommendations",
    url: "https://wiki.archlinux.org/title/General_recommendations",
    favicon: "https://www.google.com/s2/favicons?domain=archlinux.org&sz=256",
    createdAt: "2026-08-05T10:00:00.000Z",
  },
  {
    id: "c-linear",
    title: "Linear Method – Practices for building",
    url: "https://linear.app/method",
    favicon: "https://linear.app/static/favicon.svg?v=2",
    createdAt: "2026-08-26T06:00:00.000Z",
  },
  {
    id: "c-board",
    title: "Q3 sprint board",
    url: "https://notion.so/Team-HQ/Q3-sprint-board",
    favicon: "https://notion.com/front-static/logo-ios.png",
    createdAt: "2026-08-23T10:00:00.000Z",
  },
];

export const DEMO_STORY_HEALTH_ROWS = [
  {
    id: "video",
    domain: "youtube.com/watch?v=dQw4w9WgXcQ",
    favicon: getDemoBookmark("w4").favicon_url,
  },
  {
    id: "github",
    domain: "https://github.com/basecamp/omarchy",
    favicon: getDemoBookmark("p1").favicon_url,
  },
  {
    id: "board",
    domain: "notion.so/q3-sprint-board",
    favicon: DEMO_STORY_CONTEXT[2]!.favicon,
    broken: true,
  },
  {
    id: "figma",
    domain: "figma.com/community",
    favicon: getDemoBookmark("w1").favicon_url,
  },
];
