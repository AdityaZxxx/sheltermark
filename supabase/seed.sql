-- Test fixtures for the live-database isolation suites
-- (tests/integration/*-isolation.test.ts, audit.test.ts).
--
-- AGENT_USER:   52a3cabd-90dd-4019-8267-b926ffd59a6e
-- FOREIGN_USER: 8256b5a2-2c49-4e30-afd1-671c183fb7c9

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '52a3cabd-90dd-4019-8267-b926ffd59a6e',
    'authenticated', 'authenticated',
    'agent-fixture@example.com', crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Agent Fixture"}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '8256b5a2-2c49-4e30-afd1-671c183fb7c9',
    'authenticated', 'authenticated',
    'foreign-fixture@example.com', crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Foreign Fixture"}'
  );

-- on_auth_user_created gives each user a profile + default "Personal" workspace.

insert into public.workspaces (user_id, name, is_public, is_default)
values ('52a3cabd-90dd-4019-8267-b926ffd59a6e', 'Secondary', false, false);

insert into public.bookmarks (user_id, workspace_id, url, title)
select '52a3cabd-90dd-4019-8267-b926ffd59a6e', id,
  'https://example.com/agent-seed', 'Agent seed bookmark'
from public.workspaces
where user_id = '52a3cabd-90dd-4019-8267-b926ffd59a6e' and is_default;

insert into public.bookmarks (user_id, workspace_id, url, title)
select '8256b5a2-2c49-4e30-afd1-671c183fb7c9', id,
  'https://example.com/foreign-seed', 'Foreign seed bookmark'
from public.workspaces
where user_id = '8256b5a2-2c49-4e30-afd1-671c183fb7c9' and is_default;

insert into public.tags (user_id, name)
values
  ('8256b5a2-2c49-4e30-afd1-671c183fb7c9', 'foreign-seed-tag'),
  ('52a3cabd-90dd-4019-8267-b926ffd59a6e', 'agent-seed-tag');

insert into public.feeds (user_id, url, title)
values (
  '8256b5a2-2c49-4e30-afd1-671c183fb7c9',
  'https://example.com/foreign-feed.xml',
  'Foreign seed feed'
);
