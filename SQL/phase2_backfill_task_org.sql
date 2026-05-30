-- 任意: 法人登録前に作成したタスクへ organization_id を付与（コード修正後も実行可）
-- members と line_user_id が一致する行を更新

update tasks t
set organization_id = m.organization_id
from members m
where t.line_user_id = m.line_user_id
  and m.status = 'active'
  and t.organization_id is null;

update insights i
set organization_id = m.organization_id
from members m
where i.line_user_id = m.line_user_id
  and m.status = 'active'
  and i.organization_id is null;

update chat_messages c
set organization_id = m.organization_id
from members m
where c.line_user_id = m.line_user_id
  and m.status = 'active'
  and c.organization_id is null;
