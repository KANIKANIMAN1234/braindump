-- Phase 2: 組織階層・データスコープ用カラム
-- phase1_multi_tenant.sql 実行後に実行してください。

-- 業務テーブルにテナント・組織を追加
alter table tasks add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table tasks add column if not exists org_unit_id uuid references org_units(id) on delete set null;
alter table tasks add column if not exists member_id uuid references members(id) on delete set null;

alter table insights add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table insights add column if not exists org_unit_id uuid references org_units(id) on delete set null;
alter table insights add column if not exists member_id uuid references members(id) on delete set null;

alter table chat_messages add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table chat_messages add column if not exists org_unit_id uuid references org_units(id) on delete set null;
alter table chat_messages add column if not exists member_id uuid references members(id) on delete set null;

create index if not exists tasks_organization_id_idx on tasks(organization_id);
create index if not exists tasks_org_unit_id_idx on tasks(org_unit_id);
create index if not exists insights_organization_id_idx on insights(organization_id);
create index if not exists insights_org_unit_id_idx on insights(org_unit_id);

-- 利用規約同意（代表管理者の初回セットアップ時）
create table if not exists organization_agreements (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id) on delete cascade,
  member_id        uuid        not null references members(id) on delete cascade,
  agreed_at        timestamptz not null default now()
);

alter table organization_agreements enable row level security;
drop policy if exists "Deny anon organization_agreements" on organization_agreements;
create policy "Deny anon organization_agreements" on organization_agreements for all using (false);
