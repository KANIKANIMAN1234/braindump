const { createClient } = require("@supabase/supabase-js");

async function verifyLineToken(idToken) {
  const params = new URLSearchParams();
  params.append("id_token", idToken);
  params.append("client_id", process.env.LINE_CHANNEL_ID);

  const resp = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(`LINE token error: ${err.error_description || "invalid token"}`);
  }

  const data = await resp.json();
  return data.sub;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: "認証が必要です" });

  let lineUserId;
  try {
    lineUserId = await verifyLineToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: `認証エラー: ${e.message}` });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, due_date, priority")
    .eq("completed", false)
    .eq("line_user_id", lineUserId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ tasks: data || [] });
};
