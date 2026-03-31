create extension if not exists pgcrypto;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  board_id text not null default 'showcase',
  author_uid text not null,
  author_tamer_name text not null,
  slot_id integer not null,
  title text not null,
  body text not null default '',
  snapshot jsonb not null,
  comment_count integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_uid text not null,
  author_tamer_name text not null,
  body text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists community_posts_board_created_idx
  on public.community_posts (board_id, created_at desc);

create index if not exists community_posts_author_idx
  on public.community_posts (author_uid, created_at desc);

create index if not exists community_post_comments_post_created_idx
  on public.community_post_comments (post_id, created_at asc);

alter table public.community_posts enable row level security;
alter table public.community_post_comments enable row level security;

comment on table public.community_posts is
  'D2 Tamagotchi 커뮤니티 자랑 피드 게시글. 실제 read/write는 Firebase Auth 검증 후 Vercel API + Supabase service role로만 처리한다.';

comment on table public.community_post_comments is
  'community_posts에 연결된 댓글. 직접 클라이언트 접근 대신 서버 브리지로만 사용한다.';
