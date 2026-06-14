const { getSupabaseAdmin } = require("../lib/supabase-admin");
const { requireLineMember } = require("../lib/require-member");
const { applyPromptsScope, scopedRowData } = require("../lib/data-scope");
const { filterByTags } = require("../lib/execute-tools");

module.exports = async function handler(req, res) {
  const ctx = await requireLineMember(req, res);
  if (!ctx) return;

  if (!ctx.legacy && ctx.needsOrgSetup && ctx.member.role === "org_admin") {
    return res.status(403).json({
      error: "先に組織階層の設定を完了してください（⚙️管理メニュー）",
    });
  }

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const tag = req.query?.tag || req.query?.tags || null;
    const limit = Math.min(parseInt(req.query?.limit, 10) || 10, 50);
    const fetchLimit = tag ? Math.max(limit * 3, 30) : limit;

    let query = supabase
      .from("prompts")
      .select("id, title, content, tags, created_at")
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    query = applyPromptsScope(query, ctx);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    let prompts = data || [];
    if (tag) {
      prompts = filterByTags(prompts, tag).slice(0, limit);
    }

    return res.status(200).json({ prompts });
  }

  if (req.method === "POST") {
    const { title, content, tags } = req.body || {};
    const trimmedTitle = String(title || "").trim();
    const trimmedContent = String(content || "").trim();
    if (!trimmedTitle) {
      return res.status(400).json({ error: "title は必須です" });
    }
    if (!trimmedContent) {
      return res.status(400).json({ error: "content は必須です" });
    }

    const row = scopedRowData(ctx, {
      title: trimmedTitle,
      content: trimmedContent,
      tags: tags || null,
    });

    const { data, error } = await supabase
      .from("prompts")
      .insert(row)
      .select("id, title, content, tags, created_at")
      .single();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ success: true, prompt: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
