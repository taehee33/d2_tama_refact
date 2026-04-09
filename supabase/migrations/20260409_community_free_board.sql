alter table public.community_posts
  add column if not exists category text;

alter table public.community_posts
  alter column slot_id drop not null;

alter table public.community_posts
  alter column snapshot drop not null;

alter table public.community_posts
  drop constraint if exists community_posts_board_shape_chk;

alter table public.community_posts
  add constraint community_posts_board_shape_chk
  check (
    (
      board_id = 'showcase' and
      slot_id is not null and
      snapshot is not null and
      category is null
    ) or (
      board_id = 'free' and
      slot_id is null and
      snapshot is null and
      category in ('general', 'question', 'guide')
    )
  );

create index if not exists community_posts_board_category_created_idx
  on public.community_posts (board_id, category, created_at desc);

comment on column public.community_posts.category is
  '자유게시판 말머리. showcase는 null, free는 general/question/guide 중 하나를 사용한다.';
