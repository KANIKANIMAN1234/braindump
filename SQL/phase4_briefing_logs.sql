-- Phase 4: 朝ブリーフィングログ
-- Supabase SQL Editor で実行してください
-- 既に基本テーブルを作成済みの場合も、ALTER と INDEX 部分は実行可能です

create table if not exists briefing_logs (
  id              uuid        primary key default gen_random_uuid(),
  date            date        not null,
  content         text,
  task_count      integer,
  line_user_id    text,
  organization_id uuid        references organizations(id) on delete cascade,
  org_unit_id     uuid        references org_units(id) on delete set null,
  member_id       uuid        references members(id) on delete set null,
  created_at      timestamptz default now()
);

alter table briefing_logs add column if not exists line_user_id text;
alter table briefing_logs add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table briefing_logs add column if not exists org_unit_id uuid references org_units(id) on delete set null;
alter table briefing_logs add column if not exists member_id uuid references members(id) on delete set null;

alter table briefing_logs enable row level security;
drop policy if exists "Allow all" on briefing_logs;
create policy "Allow all" on briefing_logs for all using (true);

create index if not exists briefing_logs_organization_id_idx on briefing_logs(organization_id);
create index if not exists briefing_logs_line_user_id_idx on briefing_logs(line_user_id);
create index if not exists briefing_logs_date_idx on briefing_logs(date desc);

-- 同一ユーザー・同一日付は1件（再生成時は上書き）
create unique index if not exists briefing_logs_user_date_uniq
  on briefing_logs (line_user_id, date)
  where line_user_id is not null;
