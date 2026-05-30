const { getSupabaseAdmin } = require("../lib/supabase-admin");
const { requireLineMember } = require("../lib/require-member");
const { applyTasksScope } = require("../lib/data-scope");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ctx = await requireLineMember(req, res);
  if (!ctx) return;

  const supabase = getSupabaseAdmin();

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
};
