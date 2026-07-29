-- ============================================================
-- Sheltermark base schema — extracted from production
-- Created: 20260101T000000
-- Source: Live Supabase database foejratragmsvoevdcxd
--
-- This migration establishes the complete base schema.
-- All subsequent schema changes (new tables, column additions,
-- index changes) must be added as new timestamped migration files.
-- ============================================================

BEGIN;

-- ============================================================
-- Helper: citext extension (for case-insensitive tag names)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- Profiles table
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  name text,
  avatar_url text,
  bio text,
  website_url text,
  github_url text,
  x_url text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz,
  trash_cleanup_interval integer NOT NULL DEFAULT 30
);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username);
CREATE INDEX profiles_username_idx ON public.profiles USING btree (username);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can check username availability" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger: auto-set updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
begin
  new.updated_at = now();
  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles CASCADE;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Workspaces table
-- ============================================================
CREATE TABLE public.workspaces (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_public boolean,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz,
  auto_check_broken boolean DEFAULT true,
  deleted_at timestamptz,
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX workspaces_pkey ON public.workspaces USING btree (id);
CREATE INDEX workspaces_user_id_idx ON public.workspaces USING btree (user_id);
CREATE INDEX workspaces_one_default_per_user ON public.workspaces USING btree (user_id) WHERE (is_default = true);
CREATE INDEX idx_workspaces_user_default ON public.workspaces USING btree (user_id, is_default);
CREATE INDEX idx_workspaces_user_public ON public.workspaces USING btree (user_id, is_public);
CREATE INDEX idx_workspaces_deleted_at ON public.workspaces USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);

-- RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspaces" ON public.workspaces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public workspaces are viewable by everyone" ON public.workspaces
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert own workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces" ON public.workspaces
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspaces" ON public.workspaces
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger: auto-set updated_at (idempotent)
DROP TRIGGER IF EXISTS handle_updated_at ON public.workspaces CASCADE;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Bookmarks table
-- ============================================================
CREATE TABLE public.bookmarks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  url text NOT NULL,
  title text,
  favicon_url text,
  og_image_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz,
  is_public boolean DEFAULT false,
  is_broken boolean DEFAULT false,
  last_checked_at timestamptz,
  http_status integer,
  deleted_at timestamptz,
  note text,
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX bookmarks_pkey ON public.bookmarks USING btree (id);
CREATE INDEX bookmarks_user_id_idx ON public.bookmarks USING btree (user_id);
CREATE INDEX bookmarks_workspace_id_idx ON public.bookmarks USING btree (workspace_id);
CREATE INDEX bookmarks_created_at_idx ON public.bookmarks USING btree (created_at DESC);
CREATE INDEX idx_bookmarks_deleted_at ON public.bookmarks USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);
CREATE INDEX idx_bookmarks_user_url ON public.bookmarks USING btree (user_id, url);
CREATE INDEX idx_bookmarks_user_workspace ON public.bookmarks USING btree (user_id, workspace_id);
CREATE UNIQUE INDEX bookmarks_workspace_url_unique ON public.bookmarks USING btree (workspace_id, url) WHERE (deleted_at IS NULL);
CREATE INDEX bookmarks_is_broken_idx ON public.bookmarks USING btree (is_broken) WHERE (is_broken = true);
CREATE INDEX bookmarks_last_checked_at_idx ON public.bookmarks USING btree (last_checked_at);

-- RLS
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public bookmarks are viewable by everyone" ON public.bookmarks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE workspaces.id = bookmarks.workspace_id
    AND workspaces.is_public = true
  ));

CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger: auto-set updated_at (idempotent)
DROP TRIGGER IF EXISTS handle_updated_at ON public.bookmarks CASCADE;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: validate workspace ownership on insert/update (idempotent)
DROP TRIGGER IF EXISTS validate_workspace_ownership_trigger ON public.bookmarks CASCADE;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER validate_workspace_ownership_trigger
  BEFORE INSERT OR UPDATE ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_ownership();

-- ============================================================
-- Feeds table
-- ============================================================
CREATE TABLE public.feeds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  url text NOT NULL,
  title text,
  description text,
  site_url text,
  icon_url text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX feeds_pkey ON public.feeds USING btree (id);
CREATE UNIQUE INDEX feeds_user_id_url_key ON public.feeds USING btree (user_id, url);

-- RLS
ALTER TABLE public.feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feeds" ON public.feeds
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feeds" ON public.feeds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feeds" ON public.feeds
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feeds" ON public.feeds
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger: auto-set updated_at (idempotent)
DROP TRIGGER IF EXISTS handle_updated_at ON public.feeds CASCADE;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.feeds
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Feed entries table
-- ============================================================
CREATE TABLE public.feed_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  feed_id uuid NOT NULL REFERENCES public.feeds(id) ON DELETE CASCADE,
  title text NOT NULL,
  link text NOT NULL,
  content text,
  summary text,
  guid text NOT NULL,
  published timestamptz,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX feed_entries_pkey ON public.feed_entries USING btree (id);
CREATE UNIQUE INDEX feed_entries_feed_id_guid_key ON public.feed_entries USING btree (feed_id, guid);

-- RLS
ALTER TABLE public.feed_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view feed entries for their feeds" ON public.feed_entries
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.feeds
    WHERE feeds.id = feed_entries.feed_id
    AND feeds.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert feed entries for their feeds" ON public.feed_entries
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.feeds
    WHERE feeds.id = feed_entries.feed_id
    AND feeds.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete feed entries for their feeds" ON public.feed_entries
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.feeds
    WHERE feeds.id = feed_entries.feed_id
    AND feeds.user_id = auth.uid()
  ));

-- ============================================================
-- Tags table
-- ============================================================
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name citext NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id);
CREATE INDEX idx_tags_user_id ON public.tags USING btree (user_id);
CREATE INDEX idx_tags_user_name ON public.tags USING btree (user_id, name);
CREATE UNIQUE INDEX tags_user_id_name_key ON public.tags USING btree (user_id, name);

-- RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tags" ON public.tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags" ON public.tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags" ON public.tags
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags" ON public.tags
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Bookmark-tags junction table
-- ============================================================
CREATE TABLE public.bookmark_tags (
  bookmark_id uuid NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX idx_bookmark_tags_bookmark_id ON public.bookmark_tags USING btree (bookmark_id);
CREATE INDEX idx_bookmark_tags_tag_id ON public.bookmark_tags USING btree (tag_id);

-- RLS
ALTER TABLE public.bookmark_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bookmark_tags for their own bookmarks" ON public.bookmark_tags
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.bookmarks
    WHERE bookmarks.id = bookmark_tags.bookmark_id
    AND bookmarks.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert bookmark_tags for their own bookmarks" ON public.bookmark_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookmarks
      WHERE bookmarks.id = bookmark_tags.bookmark_id
      AND bookmarks.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.tags
      WHERE tags.id = bookmark_tags.tag_id
      AND tags.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete bookmark_tags for their own bookmarks" ON public.bookmark_tags
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.bookmarks
    WHERE bookmarks.id = bookmark_tags.bookmark_id
    AND bookmarks.user_id = auth.uid()
  ));

-- ============================================================
-- Functions
-- ============================================================

-- Trigger: auto-create profile + default workspace on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.workspaces (user_id, name, is_public, is_default)
  VALUES (NEW.id, 'Personal', false, true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Workspace delete (soft-delete workspace + cascade bookmarks)
CREATE OR REPLACE FUNCTION public.delete_workspace_with_bookmarks(
  p_workspace_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_is_default boolean;
BEGIN
  SELECT is_default INTO v_is_default
  FROM public.workspaces
  WHERE id = p_workspace_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workspace not found');
  END IF;

  IF v_is_default THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete default workspace');
  END IF;

  UPDATE public.workspaces
  SET deleted_at = v_now
  WHERE id = p_workspace_id AND user_id = p_user_id;

  UPDATE public.bookmarks
  SET deleted_at = v_now, updated_at = v_now
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true, 'data', null);
END;
$$;

-- Empty user trash
CREATE OR REPLACE FUNCTION public.empty_user_trash(
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.bookmarks
  WHERE user_id = p_user_id AND deleted_at IS NOT NULL;

  DELETE FROM public.workspaces
  WHERE user_id = p_user_id AND deleted_at IS NOT NULL;

  RETURN jsonb_build_object('success', true, 'data', null);
END;
$$;

COMMIT;