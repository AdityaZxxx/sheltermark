ALTER TABLE public.bookmarks ADD COLUMN broken_status text;

ALTER TABLE public.bookmarks ADD CONSTRAINT bookmarks_broken_status_check
  CHECK (broken_status IN ('alive', 'confirmed_broken', 'likely_broken', 'unknown'));

UPDATE public.bookmarks
SET broken_status = CASE
  WHEN last_checked_at IS NULL THEN NULL
  WHEN is_broken THEN 'confirmed_broken'
  ELSE 'alive'
END;
