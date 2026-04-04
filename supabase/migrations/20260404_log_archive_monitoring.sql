create table if not exists public.log_archive_monitor_events (
  id text primary key,
  request_id text not null,
  source text not null,
  outcome text not null,
  status_code integer not null,
  archive_id text,
  actor_uid text,
  owner_uids jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists log_archive_monitor_events_created_idx
  on public.log_archive_monitor_events (created_at desc);

create index if not exists log_archive_monitor_events_source_created_idx
  on public.log_archive_monitor_events (source, created_at desc);

create index if not exists log_archive_monitor_events_outcome_created_idx
  on public.log_archive_monitor_events (outcome, created_at desc);

create index if not exists log_archive_monitor_events_archive_idx
  on public.log_archive_monitor_events (archive_id);

alter table public.log_archive_monitor_events enable row level security;

comment on table public.log_archive_monitor_events is
  'D2 Tamagotchi archive 관측 이벤트. Vercel API가 성공/실패/404/권한 오류를 best-effort로 기록하며 관리자 API로 조회한다.';
