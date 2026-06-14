-- Phase 3: プロンプト保存テーブル
-- Supabase SQL Editor で実行してください

create table if not exists prompts (
  id              uuid        primary key default gen_random_uuid(),
  title           text        not null,
  content         text        not null,
  tags            text,
  line_user_id    text,
  organization_id uuid        references organizations(id) on delete cascade,
  org_unit_id     uuid        references org_units(id) on delete set null,
  member_id       uuid        references members(id) on delete set null,
  created_at      timestamptz default now()
);

alter table prompts enable row level security;
create policy "Allow all" on prompts for all using (true);

create index if not exists prompts_organization_id_idx on prompts(organization_id);
create index if not exists prompts_org_unit_id_idx on prompts(org_unit_id);
create index if not exists prompts_line_user_id_idx on prompts(line_user_id);
