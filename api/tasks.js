const { getSupabaseAdmin } = require("../lib/supabase-admin");
const { requireLineMember } = require("../lib/require-member");
const { applyTasksScope, scopedRowData } = require("../lib/data-scope");
const { parseDueDateInput } = require("../lib/parse-due-date");

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
    let query = supabase
      .from("tasks")
      .select("id, title, due_date, priority, completed")
      .or("completed.eq.false,completed.is.null")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    query = applyTasksScope(query, ctx);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ tasks: data || [] });
  }

  if (req.method === "POST") {
    const { title, due_date, priority } = req.body || {};
    const trimmedTitle = String(title || "").trim();
    if (!trimmedTitle) {
      return res.status(400).json({ error: "title は必須です" });
    }

    const validPriorities = ["高", "中", "低"];
    const prio = validPriorities.includes(priority) ? priority : "中";
    const parsedDue = due_date ? parseDueDateInput(due_date) : null;

    const row = scopedRowData(ctx, {
      title: trimmedTitle,
      due_date: parsedDue,
      priority: prio,
    });

    const { data, error } = await supabase
      .from("tasks")
      .insert(row)
      .select("id, title, due_date, priority")
      .single();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ success: true, task: data });
  }

  if (req.method === "PATCH") {
    const { id, action, result } = req.body || {};
    if (!id) return res.status(400).json({ error: "id は必須です" });
    if (action !== "complete") {
      return res.status(400).json({ error: "action は complete のみ対応しています" });
    }

    let findQuery = supabase
      .from("tasks")
      .select("id, title")
      .eq("id", id)
      .or("completed.eq.false,completed.is.null");
    findQuery = applyTasksScope(findQuery, ctx);

    const { data: tasks, error: findError } = await findQuery;
    if (findError) return res.status(500).json({ error: findError.message });
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ error: "未完了のタスクが見つかりませんでした" });
    }

    const updateData = { completed: true };
    if (result) updateData.result = result;

    const { error: updateError } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id);
    if (updateError) return res.status(500).json({ error: updateError.message });

    return res.status(200).json({
      success: true,
      title: tasks[0].title,
      result: result || null,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
