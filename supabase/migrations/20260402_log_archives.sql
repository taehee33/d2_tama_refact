create extension if not exists pgcrypto;

create table if not exists public.arena_battle_log_archives (
  id text primary key,
  user_uid text not null,
  attacker_uid text,
  attacker_name text,
  attacker_digimon_name text,
  defender_uid text,
  defender_name text,
  defender_digimon_name text,
  my_entry_id text,
  defender_entry_id text,
  winner_uid text,
  summary text,
  replay_logs jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.jogress_log_archives (
  id text primary key,
  user_uid text not null,
  host_uid text not null,
  host_tamer_name text,
  host_slot_id text,
  host_digimon_name text,
  host_slot_version text,
  guest_uid text,
  guest_tamer_name text,
  guest_slot_id text,
  guest_digimon_name text,
  guest_slot_version text,
  target_id text,
  target_name text,
  is_online boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table if exists public.arena_battle_log_archives
  add column if not exists attacker_name text,
  add column if not exists attacker_digimon_name text,
  add column if not exists defender_name text,
  add column if not exists defender_digimon_name text;

alter table if exists public.jogress_log_archives
  add column if not exists host_tamer_name text,
  add column if not exists host_digimon_name text,
  add column if not exists host_slot_version text,
  add column if not exists guest_tamer_name text,
  add column if not exists guest_digimon_name text,
  add column if not exists guest_slot_version text,
  add column if not exists is_online boolean not null default false;

create index if not exists arena_battle_log_archives_user_created_idx
  on public.arena_battle_log_archives (user_uid, created_at desc);

create index if not exists arena_battle_log_archives_attacker_created_idx
  on public.arena_battle_log_archives (attacker_uid, created_at desc);

create index if not exists arena_battle_log_archives_defender_created_idx
  on public.arena_battle_log_archives (defender_uid, created_at desc);

create index if not exists jogress_log_archives_user_created_idx
  on public.jogress_log_archives (user_uid, created_at desc);

create index if not exists jogress_log_archives_host_created_idx
  on public.jogress_log_archives (host_uid, created_at desc);

create index if not exists jogress_log_archives_guest_created_idx
  on public.jogress_log_archives (guest_uid, created_at desc);

alter table public.arena_battle_log_archives enable row level security;
alter table public.jogress_log_archives enable row level security;

comment on table public.arena_battle_log_archives is
  'D2 Tamagotchi 아레나 배틀 상세 archive. Firebase 인증 후 Vercel API를 통해서만 저장/조회한다.';

comment on table public.jogress_log_archives is
  'D2 Tamagotchi 조그레스 archive. Firebase 인증 후 Vercel API를 통해서만 저장/조회한다.';
