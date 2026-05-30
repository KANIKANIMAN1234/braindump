-- Phase 1: マルチテナント基盤（法人・メンバー・招待・監査ログ）
-- Supabase SQL Editor で実行してください。

-- ---------------------------------------------------------------------------
-- organizations（法人）
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  postal_code         text,
  address             text,
  phone               text,
  org_structure_depth int         check (org_structure_depth in (0, 1, 2, 3)),
  status              text        not null default 'pending_setup'
                      check (status in ('pending_setup', 'active', 'suspended')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- org_units（組織ツリー — Phase 2 でウィザード設定、Phase 1 はテーブルのみ）
-- ---------------------------------------------------------------------------
create table if not exists org_units (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id) on delete cascade,
  parent_id        uuid        references org_units(id) on delete cascade,
  depth            int         not null default 1,
  unit_type        text        check (unit_type in ('hq', 'section', 'dept')),
  name             text        not null,
  created_at       timestamptz not null default now()
);

create index if not exists org_units_organization_id_idx on org_units(organization_id);
create index if not exists org_units_parent_id_idx on org_units(parent_id);

-- ---------------------------------------------------------------------------
-- members（法人メンバー — 招待時 line_user_id は NULL）
-- ---------------------------------------------------------------------------
create table if not exists members (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id) on delete cascade,
  org_unit_id      uuid        references org_units(id) on delete set null,
  role             text        not null
                   check (role in ('org_admin', 'unit_admin', 'dept_admin', 'member')),
  display_name     text        not null,
  line_user_id     text,
  status           text        not null default 'invited'
                   check (status in ('invited', 'active', 'disabled')),
  invited_at       timestamptz not null default now(),
  activated_at     timestamptz,
  created_at       timestamptz not null default now()
);

create unique index if not exists members_org_line_user_id_idx
  on members(organization_id, line_user_id)
  where line_user_id is not null;

create index if not exists members_line_user_id_idx on members(line_user_id);
create index if not exists members_organization_id_idx on members(organization_id);

-- ---------------------------------------------------------------------------
-- member_invites（招待コード）
-- ---------------------------------------------------------------------------
create table if not exists member_invites (
  id                      uuid        primary key default gen_random_uuid(),
  member_id               uuid        not null references members(id) on delete cascade,
  code                    text        not null unique,
  expires_at              timestamptz not null,
  used_at                 timestamptz,
  created_by_member_id    uuid        references members(id) on delete set null,
  created_by_super_admin  boolean     not null default false,
  created_at              timestamptz not null default now()
);

create index if not exists member_invites_member_id_idx on member_invites(member_id);

-- ---------------------------------------------------------------------------
-- platform_audit_logs（運営監査 — 初期は full アクセスも記録）
-- ---------------------------------------------------------------------------
create table if not exists platform_audit_logs (
  id               uuid        primary key default gen_random_uuid(),
  actor_type       text        not null check (actor_type in ('super_admin', 'member')),
  actor_id         text,
  action           text        not null,
  organization_id  uuid        references organizations(id) on delete set null,
  metadata         jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists platform_audit_logs_organization_id_idx
  on platform_audit_logs(organization_id);

-- ---------------------------------------------------------------------------
-- RLS（Phase 1: service_role / サーバー API 経由。anon 直接アクセスは拒否）
-- ---------------------------------------------------------------------------
alter table organizations enable row level security;
alter table org_units enable row level security;
alter table members enable row level security;
alter table member_invites enable row level security;
alter table platform_audit_logs enable row level security;

-- 既存 anon キーでの直接参照を防ぐ（API は service_role を使用）
drop policy if exists "Deny anon organizations" on organizations;
create policy "Deny anon organizations" on organizations for all using (false);

drop policy if exists "Deny anon org_units" on org_units;
create policy "Deny anon org_units" on org_units for all using (false);

drop policy if exists "Deny anon members" on members;
create policy "Deny anon members" on members for all using (false);

drop policy if exists "Deny anon member_invites" on member_invites;
create policy "Deny anon member_invites" on member_invites for all using (false);

drop policy if exists "Deny anon platform_audit_logs" on platform_audit_logs;
create policy "Deny anon platform_audit_logs" on platform_audit_logs for all using (false);
