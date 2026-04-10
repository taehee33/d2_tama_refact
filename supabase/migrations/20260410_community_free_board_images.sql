insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'community-post-images',
  'community-post-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.community_posts
  add column if not exists image_path text;

alter table public.community_posts
  drop constraint if exists community_posts_board_shape_chk;

alter table public.community_posts
  add constraint community_posts_board_shape_chk
  check (
    (
      board_id = 'showcase' and
      slot_id is not null and
      snapshot is not null and
      category is null and
      image_path is null
    ) or (
      board_id = 'free' and
      slot_id is null and
      snapshot is null and
      category in ('general', 'question', 'guide')
    )
  );

comment on column public.community_posts.image_path is
  '자유게시판 첨부 이미지의 storage 경로. showcase는 null, free는 선택적으로 1장만 사용한다.';
