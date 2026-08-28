-- Avatars storage bucket + RLS policies, captured from the production setup
-- (originally created manually via the dashboard). Makes fresh environments
-- (local dev) match production; every statement is a no-op where the object
-- already exists, so applying this to production changes nothing.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can upload own avatar'
  ) then
    create policy "Users can upload own avatar" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can update own avatar'
  ) then
    create policy "Users can update own avatar" on storage.objects
      for update to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can delete own avatar'
  ) then
    create policy "Users can delete own avatar" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Anyone can view avatars'
  ) then
    create policy "Anyone can view avatars" on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'avatars');
  end if;
end
$$;
