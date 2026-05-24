const { createClient } = require("@supabase/supabase-js");

/* -------------------------------------------------------
 * LINE token 検証（アクセストークン → プロフィールAPI）
 * ----------------------------------------------------- */
async function verifyLineToken(accessToken) {
  const resp = await fetch("https://api.line.me/v2/profile", {
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error("LINE token verification failed");
  const data = await resp.json();
  return data.userId;
}

/* -------------------------------------------------------
 * ハンドラー
 * ----------------------------------------------------- */
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  /* ── LINE token 検証 ── */
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

  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("line_user_id", lineUserId)
    .gte("created_at", twelveHoursAgo)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ messages: data || [] });
};
