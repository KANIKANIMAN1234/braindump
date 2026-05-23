const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .gte("created_at", twelveHoursAgo)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ messages: data || [] });
};
