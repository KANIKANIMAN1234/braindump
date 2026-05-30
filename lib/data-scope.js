/**
 * タスク・気づき・メッセージのクエリスコープ
 */

function isPersonalScope(ctx) {
  return !ctx.isAdmin || ctx.member.role === "member";
}

/**
 * 自分のタスク（法人登録前の organization_id 未設定データを含む）
 */
function applyOwnTasksScope(query, ctx) {
  const orgId = ctx.member.organization_id;
  return query
    .eq("line_user_id", ctx.lineUserId)
    .or(`organization_id.eq.${orgId},organization_id.is.null`);
}

/** SELECT 用フィルタを query に適用 */
function applyTasksScope(query, ctx) {
  if (ctx.legacy) {
    return query.eq("line_user_id", ctx.lineUserId);
  }

  if (isPersonalScope(ctx)) {
    return applyOwnTasksScope(query, ctx);
  }

  const orgId = ctx.member.organization_id;
  const unitIds = ctx.accessibleUnitIds || [];

  if (unitIds.length === 0) {
    return applyOwnTasksScope(query, ctx);
  }

  const unitFilter = unitIds.map((id) => id).join(",");
  return query.or(
    `and(organization_id.eq.${orgId},org_unit_id.in.(${unitFilter})),and(line_user_id.eq.${ctx.lineUserId},or(organization_id.eq.${orgId},organization_id.is.null))`
  );
}

function applyInsightsScope(query, ctx) {
  return applyTasksScope(query, ctx);
}

function applyMessagesScope(query, ctx) {
  return applyTasksScope(query, ctx);
}

/** INSERT 用の行データ */
function scopedRowData(ctx, base) {
  if (ctx.legacy) {
    return { ...base, line_user_id: ctx.lineUserId };
  }
  return {
    ...base,
    line_user_id: ctx.lineUserId,
    organization_id: ctx.member.organization_id,
    org_unit_id: ctx.member.org_unit_id || null,
    member_id: ctx.member.id,
  };
}

module.exports = {
  isPersonalScope,
  applyTasksScope,
  applyInsightsScope,
  applyMessagesScope,
  scopedRowData,
};
