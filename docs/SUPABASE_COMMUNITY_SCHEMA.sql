create extension if not exists "pgcrypto";

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  board_id text not null default 'showcase',
  author_uid text not null,
  author_tamer_name text not null,
  slot_id text not null,
  title text not null,
  body text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  comment_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_uid text not null,
  author_tamer_name text not null,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists community_posts_board_created_at_idx
  on public.community_posts (board_id, created_at desc);

create index if not exists community_post_comments_post_created_at_idx
  on public.community_post_comments (post_id, created_at asc);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists community_posts_touch_updated_at on public.community_posts;
create trigger community_posts_touch_updated_at
before update on public.community_posts
for each row execute function public.touch_updated_at();

drop trigger if exists community_post_comments_touch_updated_at on public.community_post_comments;
create trigger community_post_comments_touch_updated_at
before update on public.community_post_comments
for each row execute function public.touch_updated_at();
