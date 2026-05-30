/**
 * タスク・気づき・メッセージのクエリスコープ
 */

function isPersonalScope(ctx) {
  return !ctx.isAdmin || ctx.member.role === "member";
}

/** SELECT 用フィルタを query に適用 */
function applyTasksScope(query, ctx) {
  if (ctx.legacy) {
    return query.eq("line_user_id", ctx.lineUserId);
  }

  query = query.eq("organization_id", ctx.member.organization_id);

  if (isPersonalScope(ctx)) {
    return query.eq("line_user_id", ctx.lineUserId);
  }

  if (!ctx.accessibleUnitIds || ctx.accessibleUnitIds.length === 0) {
    return query.eq("line_user_id", ctx.lineUserId);
  }

  return query.in("org_unit_id", ctx.accessibleUnitIds);
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
