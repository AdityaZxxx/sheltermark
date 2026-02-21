export interface Bookmark {
  id: string;
  user_id?: string;
  workspace_id: string | null;
  url: string;
  title: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  domain?: string;
  created_at: string;
  updated_at?: string | null;
}
