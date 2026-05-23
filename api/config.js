module.exports = function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: "SUPABASE_URL または SUPABASE_ANON_KEY が設定されていません",
    });
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ supabaseUrl, supabaseAnonKey });
};
