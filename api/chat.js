const { OpenAI } = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { Dropbox } = require("dropbox");

/* -------------------------------------------------------
 * ツール定義
 * ----------------------------------------------------- */
const tools = [
  /* ── タスク ── */
  {
    type: "function",
    function: {
      name: "add_task",
      description: "タスクを追加する",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "タスクのタイトル" },
          due_date: { type: "string", description: "期限日（YYYY-MM-DD形式）。ない場合は省略" },
          priority: { type: "string", enum: ["高", "中", "低"], description: "優先度。デフォルトは中" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "タスクを一覧取得する",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["all", "this_week", "today", "incomplete"],
            description: "all=全件, this_week=今週期限, today=今日期限, incomplete=未完了のみ",
          },
        },
        required: ["filter"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "タスクを完了にする",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "完了にするタスク名（部分一致で検索）" },
          result: { type: "string", description: "タスクの結果・成果（任意）" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "タスクを削除する",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "削除するタスク名（部分一致で検索）" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "タスクの優先度や期限を変更する",
      parameters: {
        type: "object",
        properties: {
          title:    { type: "string", description: "変更するタスク名（部分一致で検索）" },
          priority: { type: "string", enum: ["高", "中", "低"], description: "新しい優先度" },
          due_date: { type: "string", description: "新しい期限日（YYYY-MM-DD形式）。削除する場合は 'null'" },
        },
        required: ["title"],
      },
    },
  },
  /* ── 気づき ── */
  {
    type: "function",
    function: {
      name: "add_insight",
      description: "日々の気づき・学び・メモを記録する",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "気づきの内容" },
          tags: { type: "string", description: "タグ（カンマ区切り）。例: 仕事,学び" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_insights",
      description: "記録した気づきを一覧取得する",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "取得件数（デフォルト10件）" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_insights_to_dropbox",
      description: "気づきをCSVにしてDropboxへアップロードする",
      parameters: { type: "object", properties: {} },
    },
  },
];

/* -------------------------------------------------------
 * ユーティリティ
 * ----------------------------------------------------- */
function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

function toCSV(rows) {
  if (!rows || rows.length === 0) return "id,content,tags,created_at\n";
  const header = "id,content,tags,created_at";
  const lines = rows.map((r) => {
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [escape(r.id), escape(r.content), escape(r.tags ?? ""), escape(r.created_at)].join(",");
  });
  return [header, ...lines].join("\n");
}

/* -------------------------------------------------------
 * ツール実行
 * ----------------------------------------------------- */
async function executeTool(supabase, name, args) {
  /* ── タスク ── */
  if (name === "add_task") {
    const validPriorities = ["高", "中", "低"];
    const priority = validPriorities.includes(args.priority) ? args.priority : "中";
    const { error } = await supabase
      .from("tasks")
      .insert({ title: args.title, due_date: args.due_date || null, priority });
    if (error) throw error;
    return { success: true, title: args.title, due_date: args.due_date, priority };
  }

  if (name === "list_tasks") {
    const today = new Date().toISOString().split("T")[0];
    const week = getWeekRange();
    let query = supabase
      .from("tasks")
      .select("id, title, due_date, completed, priority")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (args.filter === "this_week") {
      query = query.gte("due_date", week.start).lte("due_date", week.end);
    } else if (args.filter === "today") {
      query = query.eq("due_date", today);
    } else if (args.filter === "incomplete") {
      query = query.eq("completed", false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { tasks: data || [] };
  }

  if (name === "complete_task") {
    const { data: tasks, error: findError } = await supabase
      .from("tasks")
      .select("id, title")
      .ilike("title", `%${args.title}%`)
      .eq("completed", false)
      .limit(1);
    if (findError) throw findError;
    if (!tasks || tasks.length === 0) return { success: false, message: "未完了のタスクが見つかりませんでした" };
    const updateData = { completed: true };
    if (args.result) updateData.result = args.result;
    const { error } = await supabase.from("tasks").update(updateData).eq("id", tasks[0].id);
    if (error) throw error;
    return { success: true, title: tasks[0].title, result: args.result || null };
  }

  if (name === "delete_task") {
    const { data: tasks, error: findError } = await supabase
      .from("tasks")
      .select("id, title")
      .ilike("title", `%${args.title}%`)
      .limit(1);
    if (findError) throw findError;
    if (!tasks || tasks.length === 0) return { success: false, message: "タスクが見つかりませんでした" };
    const { error } = await supabase.from("tasks").delete().eq("id", tasks[0].id);
    if (error) throw error;
    return { success: true, title: tasks[0].title };
  }

  if (name === "update_task") {
    const { data: tasks, error: findError } = await supabase
      .from("tasks")
      .select("id, title")
      .ilike("title", `%${args.title}%`)
      .limit(1);
    if (findError) throw findError;
    if (!tasks || tasks.length === 0) return { success: false, message: "タスクが見つかりませんでした" };
    const updateData = {};
    if (args.priority) {
      const validPriorities = ["高", "中", "低"];
      if (validPriorities.includes(args.priority)) updateData.priority = args.priority;
    }
    if (args.due_date !== undefined) {
      updateData.due_date = args.due_date === "null" ? null : args.due_date;
    }
    if (Object.keys(updateData).length === 0) return { success: false, message: "変更する項目がありません" };
    const { error } = await supabase.from("tasks").update(updateData).eq("id", tasks[0].id);
    if (error) throw error;
    return { success: true, title: tasks[0].title, updated: updateData };
  }

  /* ── 気づき ── */
  if (name === "add_insight") {
    const { error } = await supabase
      .from("insights")
      .insert({ content: args.content, tags: args.tags || null });
    if (error) throw error;
    return { success: true, content: args.content };
  }

  if (name === "list_insights") {
    const limit = args.limit || 10;
    const { data, error } = await supabase
      .from("insights")
      .select("id, content, tags, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { insights: data || [] };
  }

  if (name === "export_insights_to_dropbox") {
    const { data, error } = await supabase
      .from("insights")
      .select("id, content, tags, created_at")
      .is("exported_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;

    if (!data || data.length === 0) {
      return { success: true, count: 0, message: "未エクスポートの気づきはありません" };
    }

    const csv = toCSV(data);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `insights_${date}.csv`;

    const dbx = new Dropbox({
      accessToken: process.env.DROPBOX_ACCESS_TOKEN,
    });

    const dropboxPath =
      "/01_Obsidian_vault/01_AI-jissen/03_集中講座/02_supabase(2026.4)/brain-dump-app/insights";

    await dbx.filesUpload({
      path: `${dropboxPath}/${filename}`,
      contents: Buffer.from(csv, "utf-8"),
      mode: { ".tag": "overwrite" },
    });

    const ids = data.map((r) => r.id);
    const { error: updateError } = await supabase
      .from("insights")
      .update({ exported_at: new Date().toISOString() })
      .in("id", ids);
    if (updateError) throw updateError;

    return { success: true, filename, count: data.length };
  }

  return { error: "unknown tool" };
}

/* -------------------------------------------------------
 * ハンドラー
 * ----------------------------------------------------- */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "message is required" });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const today = new Date().toISOString().split("T")[0];
  const week = getWeekRange();

  const messages = [
    {
      role: "system",
      content: `あなたはタスク管理と日々の気づき記録をサポートするアシスタントです。
今日: ${today}（今週: ${week.start} 〜 ${week.end}）

できること：
- タスクの追加・一覧・完了・削除
- 気づき・学び・メモの記録と一覧表示
- 気づきをCSVにしてDropboxへエクスポート

返答は日本語で、友達に話しかけるようなフランクなトーンにしてください。
一覧を返すときは箇条書き（・）で表示してください。タスクは「タスク名（期限: MM/DD, 優先度: 高/中/低）」の形式で表示してください。`,
    },
    { role: "user", content: message },
  ];

  try {
    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
      tool_choice: "auto",
    });

    let assistantMessage = response.choices[0].message;
    let taskListData = null;

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(supabase, toolCall.function.name, args);
        if (toolCall.function.name === "list_tasks") {
          taskListData = result.tasks;
        }
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools,
        tool_choice: "auto",
      });
      assistantMessage = response.choices[0].message;
    }

    const reply = assistantMessage.content;

    // チャット履歴をDBに保存（失敗しても返答は返す）
    try {
      await supabase.from("chat_messages").insert([
        { role: "user", content: message },
        { role: "bot",  content: reply },
      ]);
    } catch (saveErr) {
      console.error("履歴保存エラー:", saveErr);
    }

    res.status(200).json({ reply, ...(taskListData !== null && { tasks: taskListData }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
