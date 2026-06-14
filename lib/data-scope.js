/**
 * タスク・気づき・メッセージのクエリスコープ
 */

function isPersonalScope(ctx) {
  return !ctx.isAdmin || ctx.member.role === "member";
}

/**
 * 自分のタスク（organization_id 未設定の移行データも含む）
 */
function applyOwnTasksScope(query, ctx) {
  const orgId = ctx.member.organization_id;
  const lineId = ctx.lineUserId;
  return query.or(
    `and(organization_id.eq.${orgId},line_user_id.eq.${lineId}),and(organization_id.is.null,line_user_id.eq.${lineId})`
  );
}

/** SELECT 用フィルタを query に適用 */
function applyTasksScope(query, ctx) {
  if (ctx.legacy) {
    return query.eq("line_user_id", ctx.lineUserId);
  }

  const orgId = ctx.member.organization_id;
  const lineId = ctx.lineUserId;
  const unitIds = ctx.accessibleUnitIds || [];
  const ownLegacy = `and(organization_id.is.null,line_user_id.eq.${lineId})`;

  // 代表管理者: 法人内の全タスク（line_user_id の不一致・移行データも含む）
  if (ctx.member.role === "org_admin") {
    return query.eq("organization_id", orgId);
  }

  // 自分の法人内タスク（org_unit_id が null の既存タスクもここに含める）
  const ownInOrg = `and(organization_id.eq.${orgId},line_user_id.eq.${lineId})`;

  if (isPersonalScope(ctx) || unitIds.length === 0) {
    return query.or(`${ownInOrg},${ownLegacy}`);
  }

  const unitFilter = unitIds.join(",");
  // 配下ユニットのタスク ＋ 自分のタスク（org_unit_id 未設定含む）
  return query.or(
    `${ownInOrg},${ownLegacy},and(organization_id.eq.${orgId},org_unit_id.in.(${unitFilter}))`
  );
}

function applyInsightsScope(query, ctx) {
  return applyTasksScope(query, ctx);
}

function applyPromptsScope(query, ctx) {
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
  applyPromptsScope,
  applyMessagesScope,
  scopedRowData,
};
