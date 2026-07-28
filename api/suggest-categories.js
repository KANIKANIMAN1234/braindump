const { OpenAI } = require("openai");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { content, type } = req.body || {};
  if (!content) return res.status(400).json({ error: "content is required" });

  const isPrompt = type === "prompt";
  const isReflection = type === "reflection";
  const defaults = isPrompt
    ? ["文章作成", "コーディング", "分析", "要約", "その他"]
    : isReflection
    ? ["仕事", "健康", "人間関係", "学び", "その他"]
    : ["仕事", "学び", "アイデア", "日常", "その他"];

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: isPrompt
            ? '以下のプロンプトに対して適切なカテゴリを4〜5個提案してください。必ず {"categories": ["カテゴリ1","カテゴリ2",...]} の形式で返してください。'
            : isReflection
            ? '以下の1日の振り返りに対して適切なカテゴリを4〜5個提案してください。必ず {"categories": ["カテゴリ1","カテゴリ2",...]} の形式で返してください。'
            : '以下の気づきに対して適切なカテゴリを4〜5個提案してください。必ず {"categories": ["カテゴリ1","カテゴリ2",...]} の形式で返してください。',
        },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories
      : defaults;

    res.status(200).json({ categories });
  } catch {
    res.status(200).json({ categories: defaults });
  }
};
