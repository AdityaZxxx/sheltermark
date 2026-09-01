-- Security hardening pass (RLS + trigger fixes). No schema changes; safe to
-- apply to production as-is.
--
-- 1. UPDATE policies on profiles/workspaces/bookmarks/feeds gain WITH CHECK
--    so an authenticated client (PostgREST path) can't reassign rows to
--    another user by rewriting user_id. tags/cloud_connections already had it.
-- 2. validate_workspace_ownership trigger now allows workspace_id IS NULL —
--    the app supports workspace-less bookmarks (move to "unsorted", insert
--    without a workspace) and the old trigger rejected every such write.
-- 3. handle_new_user no longer breaks signup on username collisions
--    (john@gmail.com vs john@yahoo.com both mapped to "john" and the UNIQUE
--    constraint aborted the whole signup trigger); sanitized + suffixed.
-- 4. All SECURITY DEFINER functions pin search_path = ''.

-- ============================================================
-- 1. UPDATE policies: add WITH CHECK
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own workspaces" ON public.workspaces;
CREATE POLICY "Users can update own workspaces" ON public.workspaces
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own feeds" ON public.feeds;
CREATE POLICY "Users can update their own feeds" ON public.feeds
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. Workspace-ownership trigger: allow NULL (unsorted) workspace
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_workspace_ownership()
RETURNS trigger AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = NEW.workspace_id
    AND w.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Workspace does not belong to user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================
-- 3. Signup trigger: collision-proof username
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_base text;
  v_username text;
  v_suffix integer := 0;
BEGIN
  -- Sanitize the email local part to the username grammar (a-z0-9_, min 3,
  -- max 30 — matches usernameSchema in lib/schemas/profile.schema.ts),
  -- fall back to "user" when it sanitizes to nothing usable. The regex
  -- strips case-insensitively (keeping uppercase letters) because lower()
  -- runs after the strip, not before.
  v_base := lower(
    regexp_replace(split_part(coalesce(NEW.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g')
  );
  IF v_base ~ '^[a-z0-9_]{3,30}$' IS NOT TRUE THEN
    v_base := 'user';
  END IF;
  -- Cap at 29 so the collision suffix (up to 2 digits) always fits within
  -- the 30-char limit; left(base||suffix, 30) would otherwise truncate the
  -- suffix away and spin the loop.
  v_base := left(v_base, 28);
  v_username := v_base;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_suffix := v_suffix + 1;
    IF v_suffix > 99 THEN
      -- ponytail: 100 same-prefix users in one race is a non-event; use the
      -- UUID prefix which cannot collide.
      v_username := left('u' || replace(NEW.id::text, '-', ''), 30);
      EXIT;
    END IF;
    v_username := left(v_base || v_suffix::text, 30);
  END LOOP;

  INSERT INTO public.profiles (id, name, avatar_url, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    v_username
  );

  INSERT INTO public.workspaces (user_id, name, is_public, is_default)
  VALUES (NEW.id, 'Personal', false, true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================
-- 4. Pin search_path on remaining SECURITY DEFINER functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
begin
  new.updated_at = now();
  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
