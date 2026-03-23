-- Enable extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  username text UNIQUE,
  full_name text,
  avatar_url text,
  bio text,
  website_url text,
  github_url text,
  x_url text,

  is_public boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz
);

CREATE INDEX profiles_username_idx ON public.profiles(username);

-- WORKSPACES
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id uuid NOT NULL
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  name text NOT NULL,
  is_public boolean DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz
);

-- Only one default workspace per user
CREATE UNIQUE INDEX workspaces_one_default_per_user
ON public.workspaces(user_id)
WHERE is_default = true;

CREATE INDEX workspaces_user_id_idx ON public.workspaces(user_id);

-- BOOKMARKS
CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id uuid NOT NULL
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  workspace_id uuid NOT NULL,

  url text NOT NULL,
  title text,
  favicon_url text,
  og_image_url text,

  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz,

  -- FK composite validation via trigger-safe approach
  CONSTRAINT bookmarks_workspace_fk
    FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces(id)
    ON DELETE CASCADE
);

-- Prevent duplicate URL inside same workspace
CREATE UNIQUE INDEX bookmarks_workspace_url_unique
ON public.bookmarks(workspace_id, url);

CREATE INDEX bookmarks_user_id_idx ON public.bookmarks(user_id);
CREATE INDEX bookmarks_workspace_id_idx ON public.bookmarks(workspace_id);
CREATE INDEX bookmarks_created_at_idx ON public.bookmarks(created_at DESC);


-- OWNERSHIP INTEGRITY CHECK

-- Ensure workspace belongs to same user as bookmark
CREATE OR REPLACE FUNCTION public.validate_workspace_ownership()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = NEW.workspace_id
    AND w.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Workspace does not belong to user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_workspace_ownership_trigger
BEFORE INSERT OR UPDATE ON public.bookmarks
FOR EACH ROW
EXECUTE FUNCTION public.validate_workspace_ownership();

-- RLS POLICIES

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles FOR SELECT USING (is_public = true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- WORKSPACES
CREATE POLICY "Users can view own workspaces"
ON workspaces FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workspaces"
ON workspaces FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces"
ON workspaces FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspaces"
ON workspaces FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public workspaces are viewable by everyone"
ON workspaces FOR SELECT USING (is_public = true);

-- BOOKMARKS
CREATE POLICY "Users can view own bookmarks"
ON bookmarks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks"
ON bookmarks FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
ON bookmarks FOR DELETE USING (auth.uid() = user_id);