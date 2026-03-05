export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  github_url: string | null;
  x_url: string | null;
  website_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at?: string | null;
}
