export interface Workspace {
  id: string;
  name: string;
  is_public?: boolean;
  is_default?: boolean;
  bookmarks_count?: number;
  user_id?: string;
  created_at?: string;
}

export interface WorkspaceWithBookmarks {
  id: string;
  name: string;
  bookmarks: {
    id: string;
    title: string;
    url: string;
    favicon_url: string | null;
    og_image_url: string | null;
    created_at: string;
  }[];
}
