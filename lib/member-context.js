const { getSupabaseAdmin } = require("./supabase-admin");
const { getAccessibleUnitIds } = require("./org-tree");

/**
 * LINE ユーザーからメンバーコンテキストを解決
 * @returns { legacy: true, lineUserId } | { legacy: false, ... }
 */
async function resolveMemberContext(lineUserId) {
  const supabase = getSupabaseAdmin();

  const { data: members, error } = await supabase
    .from("members")
    .select("id, organization_id, org_unit_id, role, display_name, line_user_id, status")
    .eq("line_user_id", lineUserId)
    .eq("status", "active");

  if (error) throw error;

  if (!members || members.length === 0) {
    return { legacy: true, lineUserId };
  }

  const member = members[0];

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, status, org_structure_depth")
    .eq("id", member.organization_id)
    .single();

  if (orgError) throw orgError;

  const accessibleUnitIds = await getAccessibleUnitIds(
    supabase,
    member,
    member.organization_id
  );

  const isAdmin = ["org_admin", "unit_admin", "dept_admin"].includes(member.role);
  const canManageOrg =
    member.role === "org_admin" && organization.status === "pending_setup";
  const canInvite = isAdmin && organization.status === "active";

  return {
    legacy: false,
    lineUserId,
    member,
    organization,
    accessibleUnitIds,
    isAdmin,
    canManageOrg,
    canInvite,
    needsOrgSetup:
      member.role === "org_admin" && organization.status === "pending_setup",
  };
}

module.exports = { resolveMemberContext };
