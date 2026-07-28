const { OpenAI } = require("openai");
const { getSupabaseAdmin } = require("../lib/supabase-admin");
const { extractBearerToken } = require("../lib/line-auth");
const { resolveMemberContext } = require("../lib/member-context");
const { executeTool, getWeekRange } = require("../lib/execute-tools");
const { scopedRowData } = require("../lib/data-scope");

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
          tag: { type: "string", description: "タグで絞り込み（例: アイデア）。カンマ区切りで複数指定可" },
          tags: { type: "string", description: "tag と同じ。カンマ区切りで複数タグ指定可" },
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
  /* ── プロンプト ── */
  {
    type: "function",
    function: {
      name: "add_prompt",
      description: "AIプロンプトを記録・保存する",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "プロンプトのタイトル（短い名前）" },
          content: { type: "string", description: "プロンプト本文" },
          tags: { type: "string", description: "タグ（カンマ区切り）。例: 文章作成,分析" },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_prompts",
      description: "保存したプロンプトを一覧取得する",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "取得件数（デフォルト10件）" },
          tag: { type: "string", description: "タグで絞り込み。カンマ区切りで複数指定可" },
          tags: { type: "string", description: "tag と同じ。カンマ区切りで複数タグ指定可" },
        },
      },
    },
  },
  /* ── 朝ブリーフィング ── */
  {
    type: "function",
    function: {
      name: "save_briefing",
      description: "指定日の朝ブリーフィングを保存する（同日があれば上書き）",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "日付（YYYY-MM-DD）。省略時は今日" },
          content: { type: "string", description: "ブリーフィング本文（要約・今日の焦点）" },
          task_count: { type: "number", description: "対象タスク件数（未完了数など）" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_briefing",
      description: "指定日の朝ブリーフィングを取得する",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "日付（YYYY-MM-DD）。省略時は今日" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_briefings",
      description: "過去の朝ブリーフィングを一覧取得する",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "取得件数（デフォルト7件）" },
        },
      },
    },
  },
  /* ── 今日の振り返り ── */
  {
    type: "function",
    function: {
      name: "save_reflection",
      description: "指定日の振り返りを保存する（同日があれば上書き）",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "日付（YYYY-MM-DD）。省略時は今日" },
          content: { type: "string", description: "振り返りの本文" },
          tags: { type: "string", description: "タグ（カンマ区切り）。例: 仕事,健康" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_reflection",
      description: "指定日の振り返りを取得する",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "日付（YYYY-MM-DD）。省略時は今日" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reflections",
      description: "過去の振り返りを一覧取得する",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "取得件数（デフォルト7件）" },
          tag: { type: "string", description: "タグで絞り込み。カンマ区切りで複数指定可" },
          tags: { type: "string", description: "tag と同じ。カンマ区切りで複数タグ指定可" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_reflections_to_dropbox",
      description: "今日の振り返りをCSVにして、気づきエクスポートと同じDropboxの場所へアップロードする",
      parameters: { type: "object", properties: {} },
    },
  },
];

/* -------------------------------------------------------
 * ハンドラー
 * ----------------------------------------------------- */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "message is required" });

  const idToken = extractBearerToken(req);
  if (!idToken) return res.status(401).json({ error: "認証が必要です（LINEからアクセスしてください）" });

  let ctx;
  try {
    const { verifyLineToken } = require("../lib/line-auth");
    const lineProfile = await verifyLineToken(idToken);
    ctx = await resolveMemberContext(lineProfile.userId);
  } catch (e) {
    return res.status(401).json({ error: `認証エラー: ${e.message}` });
  }

  if (!ctx.legacy && ctx.needsOrgSetup && ctx.member.role === "org_admin") {
    return res.status(403).json({
      error: "先に組織階層の設定を完了してください（⚙️管理メニュー）",
    });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabase = getSupabaseAdmin();

  const today = new Date().toISOString().split("T")[0];
  const week = getWeekRange();

  const messages = [
    {
      role: "system",
      content: `あなたはタスク管理・日々の気づき記録・プロンプト保存・朝ブリーフィング・今日の振り返りをサポートするアシスタントです。
今日: ${today}（今週: ${week.start} 〜 ${week.end}）

できること：
- タスクの追加・一覧・完了・削除
- タスクの優先度変更（update_task ツールを使う）
- タスクの期日変更（update_task ツールを使う）
- 気づき・学び・メモの記録と一覧表示
- 気づきをCSVにしてDropboxへエクスポート
- AIプロンプトの記録と一覧表示
- 朝ブリーフィングの作成・取得・一覧（briefing_logs に保存）
- 今日の振り返りの記録・取得・一覧（daily_reflections に保存）、CSVでのDropboxエクスポート

「〇〇のタスクを追加して」「タスクを追加」などの指示は必ず add_task ツールを呼び出して実行すること。
「〇〇を完了にして」「〇〇を完了」などの指示は必ず complete_task ツールを呼び出して実行すること。
「〇〇の優先度を△△に変更して」「〇〇の期日を△△にして」などの指示は必ず update_task ツールを呼び出して実行すること。
気づきを記録するときは必ず add_insight ツールを呼び出し、メッセージに含まれるタグを tags 引数に渡すこと。タグがない場合は tags を省略すること。
プロンプトを記録するときは必ず add_prompt ツールを呼び出し、タイトル・本文・タグを引数に渡すこと。
朝ブリーフィングを作成するときは、まず list_tasks（filter: incomplete）で未完了タスクを確認し、今日の要点を300字程度でまとめて save_briefing で保存すること。task_count には未完了タスク数を入れること。
ブリーフィングを確認・表示するときは get_briefing または list_briefings を使うこと。
「今日の振り返りを記録：〇〇」のように振り返りの記録を依頼されたときは必ず save_reflection ツールを呼び出し、本文をそのまま content 引数に渡し、メッセージに含まれるタグを tags 引数に渡すこと（同日にすでに記録があれば上書きされる）。タグがない場合は tags を省略すること。
振り返りを確認・表示するときは get_reflection または list_reflections を使うこと。
「気づきをエクスポートして」は export_insights_to_dropbox、「振り返りをエクスポートして」は export_reflections_to_dropbox を呼び出すこと。「気づきと振り返りをエクスポートして」のように両方求められた場合は両方のツールを呼び出すこと（同じDropboxフォルダに別々のCSVとして保存される）。
ツールを呼ばずに「追加しました」「完了しました」などと返答してはいけない。
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
    let insightListData = null;
    let insightFilterTag = null;
    let promptListData = null;
    let promptFilterTag = null;
    let briefingData;
    let briefingListData = null;
    let reflectionData;
    let reflectionListData = null;

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(supabase, toolCall.function.name, args, ctx);
        if (toolCall.function.name === "list_tasks") {
          const rows = result.tasks || [];
          taskListData = rows.filter((t) => !t.completed);
        }
        if (toolCall.function.name === "add_insight") {
          const tagFilter = args.tags || "アイデア";
          const listResult = await executeTool(supabase, "list_insights", {
            limit: 10,
            tags: tagFilter,
          }, ctx);
          insightListData = listResult.insights || [];
          insightFilterTag = tagFilter;
        }
        if (toolCall.function.name === "list_insights") {
          insightListData = result.insights || [];
          insightFilterTag = args.tags || args.tag || null;
        }
        if (toolCall.function.name === "add_prompt") {
          const tagFilter = args.tags || "文章作成";
          const listResult = await executeTool(supabase, "list_prompts", {
            limit: 10,
            tags: tagFilter,
          }, ctx);
          promptListData = listResult.prompts || [];
          promptFilterTag = tagFilter;
        }
        if (toolCall.function.name === "list_prompts") {
          promptListData = result.prompts || [];
          promptFilterTag = args.tags || args.tag || null;
        }
        if (toolCall.function.name === "save_briefing" && result.briefing) {
          briefingData = result.briefing;
        }
        if (toolCall.function.name === "get_briefing") {
          briefingData = result.briefing || null;
        }
        if (toolCall.function.name === "list_briefings") {
          briefingListData = result.briefings || [];
        }
        if (toolCall.function.name === "save_reflection" && result.reflection) {
          reflectionData = result.reflection;
        }
        if (toolCall.function.name === "get_reflection") {
          reflectionData = result.reflection || null;
        }
        if (toolCall.function.name === "list_reflections") {
          reflectionListData = result.reflections || [];
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

    /* チャット履歴をDBに保存（失敗しても返答は返す） */
    try {
      await supabase.from("chat_messages").insert([
        scopedRowData(ctx, { role: "user", content: message }),
        scopedRowData(ctx, { role: "bot", content: reply }),
      ]);
    } catch (saveErr) {
      console.error("履歴保存エラー:", saveErr);
    }

    res.status(200).json({
      reply,
      ...(taskListData !== null && { tasks: taskListData }),
      ...(insightListData !== null && {
        insights: insightListData,
        insightTag: insightFilterTag,
      }),
      ...(promptListData !== null && {
        prompts: promptListData,
        promptTag: promptFilterTag,
      }),
      ...(briefingData !== undefined && { briefing: briefingData }),
      ...(briefingListData !== null && { briefings: briefingListData }),
      ...(reflectionData !== undefined && { reflection: reflectionData }),
      ...(reflectionListData !== null && { reflections: reflectionListData }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
