-- Phase 5: 今日の振り返りログ
-- Supabase SQL Editor で実行してください
-- 既に基本テーブルを作成済みの場合も、ALTER と INDEX 部分は実行可能です

create table if not exists daily_reflections (
  id              uuid        primary key default gen_random_uuid(),
  entry_date      date        not null default current_date,
  content         text        not null,
  tags            text,
  exported_at     timestamptz default null,
  line_user_id    text,
  organization_id uuid        references organizations(id) on delete cascade,
  org_unit_id     uuid        references org_units(id) on delete set null,
  member_id       uuid        references members(id) on delete set null,
  created_at      timestamptz default now()
);

alter table daily_reflections add column if not exists tags text;
alter table daily_reflections add column if not exists exported_at timestamptz default null;
alter table daily_reflections add column if not exists line_user_id text;
alter table daily_reflections add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table daily_reflections add column if not exists org_unit_id uuid references org_units(id) on delete set null;
alter table daily_reflections add column if not exists member_id uuid references members(id) on delete set null;

alter table daily_reflections enable row level security;
drop policy if exists "Allow all" on daily_reflections;
create policy "Allow all" on daily_reflections for all using (true);

create index if not exists daily_reflections_organization_id_idx on daily_reflections(organization_id);
create index if not exists daily_reflections_line_user_id_idx on daily_reflections(line_user_id);
create index if not exists daily_reflections_entry_date_idx on daily_reflections(entry_date desc);

-- 同一ユーザー・同一日付は1件（再登録時は上書き）
create unique index if not exists daily_reflections_user_date_uniq
  on daily_reflections (line_user_id, entry_date)
  where line_user_id is not null;
