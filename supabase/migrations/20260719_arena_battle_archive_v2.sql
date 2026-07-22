alter table public.arena_battle_log_archives
  add column if not exists payload_hash text,
  add column if not exists schema_version integer,
  add column if not exists season_id_at_battle integer,
  add column if not exists battle_rules_version text;

create unique index if not exists arena_battle_log_archives_payload_hash_id_idx
  on public.arena_battle_log_archives (id, payload_hash);
