-- 法人登録前後で line_user_id が食い違っているデータを代表管理者に揃える
-- 実行前に「1. 診断」で内容を確認してください。

-- ---------------------------------------------------------------------------
-- 1. 診断（タスク側 vs メンバー側の LINE ID）
-- ---------------------------------------------------------------------------
-- select
--   o.name as organization_name,
--   m.display_name,
--   m.status,
--   m.role,
--   m.line_user_id as member_line_user_id,
--   t.line_user_id as task_line_user_id,
--   count(*) filter (where t.completed = false) as incomplete_tasks
-- from organizations o
-- join members m on m.organization_id = o.id and m.role = 'org_admin'
-- left join tasks t on t.organization_id = o.id
-- where o.id = '7e47f0b1-34cf-446e-865f-e94fbe793329'  -- 法人UUID
-- group by o.name, m.display_name, m.status, m.role, m.line_user_id, t.line_user_id;

-- ---------------------------------------------------------------------------
-- 2a-pre. 手入力時の余白・改行を除去し active にする（今回の事象用）
-- update members
-- set
--   line_user_id = trim(both E' \t\r\n' from line_user_id),
--   status = 'active',
--   activated_at = coalesce(activated_at, now())
-- where organization_id = '7e47f0b1-34cf-446e-865f-e94fbe793329'
--   and role = 'org_admin';

-- 2a. members に LINE ID を登録（未登録の代表管理者）
--     タスクに最も多い line_user_id を採用（同一人物の法人登録前 ID）
-- ---------------------------------------------------------------------------
update members m
set
  line_user_id = src.line_user_id,
  status = 'active',
  activated_at = coalesce(m.activated_at, now())
from (
  select line_user_id
  from tasks
  where organization_id = '7e47f0b1-34cf-446e-865f-e94fbe793329'
    and line_user_id is not null
  group by line_user_id
  order by count(*) desc
  limit 1
) src
where m.organization_id = '7e47f0b1-34cf-446e-865f-e94fbe793329'
  and m.role = 'org_admin'
  and m.line_user_id is null;

-- ---------------------------------------------------------------------------
-- 2b. タスク・気づき・履歴を代表の line_user_id / member_id に揃える
-- ---------------------------------------------------------------------------
update tasks t
set
  line_user_id = m.line_user_id,
  member_id = m.id
from members m
where t.organization_id = m.organization_id
  and m.role = 'org_admin'
  and m.status = 'active'
  and m.line_user_id is not null
  and t.organization_id = '7e47f0b1-34cf-446e-865f-e94fbe793329';

update insights i
set
  line_user_id = m.line_user_id,
  member_id = m.id
from members m
where i.organization_id = m.organization_id
  and m.role = 'org_admin'
  and m.status = 'active'
  and m.line_user_id is not null
  and i.organization_id = '7e47f0b1-34cf-446e-865f-e94fbe793329';

update chat_messages c
set
  line_user_id = m.line_user_id,
  member_id = m.id
from members m
where c.organization_id = m.organization_id
  and m.role = 'org_admin'
  and m.status = 'active'
  and m.line_user_id is not null
  and c.organization_id = '7e47f0b1-34cf-446e-865f-e94fbe793329';
