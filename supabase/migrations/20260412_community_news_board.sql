alter table public.community_posts
  add column if not exists support_context jsonb,
  add column if not exists news_context jsonb;

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
      image_path is null and
      support_context is null and
      news_context is null
    ) or (
      board_id = 'free' and
      slot_id is null and
      snapshot is null and
      category in ('general', 'question', 'guide') and
      support_context is null and
      news_context is null
    ) or (
      board_id = 'support' and
      slot_id is null and
      snapshot is null and
      category in ('bug', 'question', 'solved') and
      news_context is null
    ) or (
      board_id = 'news' and
      slot_id is null and
      snapshot is null and
      category in ('notice', 'patch', 'event', 'maintenance') and
      support_context is null
    )
  );

comment on column public.community_posts.category is
  '텍스트 게시판 말머리. showcase는 null, free는 general/question/guide, support는 bug/question/solved, news는 notice/patch/event/maintenance를 사용한다.';

comment on column public.community_posts.image_path is
  '텍스트 게시판 첨부 이미지의 storage 경로. showcase는 null, free/support/news는 선택적으로 1장만 사용한다.';

comment on column public.community_posts.support_context is
  '버그제보/QnA 보드 전용 보조 정보. slotNumber, screenPath, gameVersion 키를 jsonb로 저장한다.';

comment on column public.community_posts.news_context is
  '소식 보드 전용 메타 정보. summary, version, scope, startsAt, endsAt, featured 키를 jsonb로 저장한다.';
