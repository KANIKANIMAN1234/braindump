const { Dropbox } = require("dropbox");
const {
  applyTasksScope,
  applyInsightsScope,
  applyPromptsScope,
  applyBriefingLogsScope,
  applyDailyReflectionsScope,
  scopedRowData,
} = require("./data-scope");

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

function toReflectionCSV(rows) {
  if (!rows || rows.length === 0) return "id,entry_date,content,tags,created_at\n";
  const header = "id,entry_date,content,tags,created_at";
  const lines = rows.map((r) => {
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [
      escape(r.id),
      escape(r.entry_date),
      escape(r.content),
      escape(r.tags ?? ""),
      escape(r.created_at),
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

function scopedFindTasks(supabase, ctx) {
  let q = supabase.from("tasks").select("id, title, line_user_id, org_unit_id");
  return applyTasksScope(q, ctx);
}

function parseInsightTags(tagsStr) {
  if (!tagsStr) return [];
  return String(tagsStr)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function filterInsightsByTags(insights, tagsInput) {
  const filterTags = Array.isArray(tagsInput)
    ? tagsInput
    : parseInsightTags(tagsInput);
  if (filterTags.length === 0) return insights;
  return insights.filter((insight) => {
    const rowTags = parseInsightTags(insight.tags);
    return filterTags.some((tag) => rowTags.includes(tag));
  });
}

const filterByTags = filterInsightsByTags;

async function executeTool(supabase, name, args, ctx) {
  const lineUserId = ctx.lineUserId;

  if (name === "add_task") {
    const validPriorities = ["高", "中", "低"];
    const priority = validPriorities.includes(args.priority) ? args.priority : "中";
    const row = scopedRowData(ctx, {
      title: args.title,
      due_date: args.due_date || null,
      priority,
    });
    const { error } = await supabase.from("tasks").insert(row);
    if (error) throw error;
    return { success: true, title: args.title, due_date: args.due_date, priority };
  }

  if (name === "list_tasks") {
    const today = new Date().toISOString().split("T")[0];
    const week = getWeekRange();
    let query = supabase
      .from("tasks")
      .select("id, title, due_date, completed, priority, line_user_id")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    query = applyTasksScope(query, ctx);

    if (args.filter === "this_week") {
      query = query.gte("due_date", week.start).lte("due_date", week.end);
    } else if (args.filter === "today") {
      query = query.eq("due_date", today);
    } else if (args.filter === "incomplete") {
      query = query.or("completed.eq.false,completed.is.null");
    }

    const { data, error } = await query;
    if (error) throw error;
    return { tasks: data || [] };
  }

  if (name === "complete_task") {
    let query = scopedFindTasks(supabase, ctx)
      .ilike("title", `%${args.title}%`)
      .or("completed.eq.false,completed.is.null")
      .limit(1);
    const { data: tasks, error: findError } = await query;
    if (findError) throw findError;
    if (!tasks || tasks.length === 0) {
      return { success: false, message: "未完了のタスクが見つかりませんでした" };
    }
    const updateData = { completed: true };
    if (args.result) updateData.result = args.result;
    const { error } = await supabase.from("tasks").update(updateData).eq("id", tasks[0].id);
    if (error) throw error;
    return { success: true, title: tasks[0].title, result: args.result || null };
  }

  if (name === "delete_task") {
    let query = scopedFindTasks(supabase, ctx)
      .ilike("title", `%${args.title}%`)
      .limit(1);
    const { data: tasks, error: findError } = await query;
    if (findError) throw findError;
    if (!tasks || tasks.length === 0) {
      return { success: false, message: "タスクが見つかりませんでした" };
    }
    const { error } = await supabase.from("tasks").delete().eq("id", tasks[0].id);
    if (error) throw error;
    return { success: true, title: tasks[0].title };
  }

  if (name === "update_task") {
    let query = scopedFindTasks(supabase, ctx)
      .ilike("title", `%${args.title}%`)
      .limit(1);
    const { data: tasks, error: findError } = await query;
    if (findError) throw findError;
    if (!tasks || tasks.length === 0) {
      return { success: false, message: "タスクが見つかりませんでした" };
    }
    const updateData = {};
    if (args.priority) {
      const validPriorities = ["高", "中", "低"];
      if (validPriorities.includes(args.priority)) updateData.priority = args.priority;
    }
    if (args.due_date !== undefined) {
      updateData.due_date = args.due_date === "null" ? null : args.due_date;
    }
    if (Object.keys(updateData).length === 0) {
      return { success: false, message: "変更する項目がありません" };
    }
    const { error } = await supabase.from("tasks").update(updateData).eq("id", tasks[0].id);
    if (error) throw error;
    return { success: true, title: tasks[0].title, updated: updateData };
  }

  if (name === "add_insight") {
    const row = scopedRowData(ctx, {
      content: args.content,
      tags: args.tags || null,
    });
    const { error } = await supabase.from("insights").insert(row);
    if (error) throw error;
    return { success: true, content: args.content };
  }

  if (name === "list_insights") {
    const limit = args.limit || 10;
    const tagFilter = args.tags || args.tag || null;
    const fetchLimit = tagFilter ? Math.max(limit * 3, 30) : limit;
    let query = supabase
      .from("insights")
      .select("id, content, tags, created_at, line_user_id")
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
    query = applyInsightsScope(query, ctx);
    const { data, error } = await query;
    if (error) throw error;
    let insights = data || [];
    if (tagFilter) {
      insights = filterInsightsByTags(insights, tagFilter).slice(0, limit);
    }
    return { insights };
  }

  if (name === "add_prompt") {
    const row = scopedRowData(ctx, {
      title: args.title,
      content: args.content,
      tags: args.tags || null,
    });
    const { error } = await supabase.from("prompts").insert(row);
    if (error) throw error;
    return { success: true, title: args.title, content: args.content };
  }

  if (name === "list_prompts") {
    const limit = args.limit || 10;
    const tagFilter = args.tags || args.tag || null;
    const fetchLimit = tagFilter ? Math.max(limit * 3, 30) : limit;
    let query = supabase
      .from("prompts")
      .select("id, title, content, tags, created_at, line_user_id")
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
    query = applyPromptsScope(query, ctx);
    const { data, error } = await query;
    if (error) throw error;
    let prompts = data || [];
    if (tagFilter) {
      prompts = filterByTags(prompts, tagFilter).slice(0, limit);
    }
    return { prompts };
  }

  if (name === "save_briefing") {
    const date = args.date || new Date().toISOString().split("T")[0];
    let findQuery = supabase
      .from("briefing_logs")
      .select("id")
      .eq("date", date);
    findQuery = applyBriefingLogsScope(findQuery, ctx);
    const { data: existing, error: findError } = await findQuery.maybeSingle();
    if (findError) throw findError;

    const payload = {
      content: args.content,
      task_count: args.task_count ?? null,
    };

    if (existing) {
      const { data, error } = await supabase
        .from("briefing_logs")
        .update(payload)
        .eq("id", existing.id)
        .select("id, date, content, task_count, created_at")
        .single();
      if (error) throw error;
      return { success: true, updated: true, briefing: data };
    }

    const row = scopedRowData(ctx, { date, ...payload });
    const { data, error } = await supabase
      .from("briefing_logs")
      .insert(row)
      .select("id, date, content, task_count, created_at")
      .single();
    if (error) throw error;
    return { success: true, updated: false, briefing: data };
  }

  if (name === "get_briefing") {
    const date = args.date || new Date().toISOString().split("T")[0];
    let query = supabase
      .from("briefing_logs")
      .select("id, date, content, task_count, created_at")
      .eq("date", date);
    query = applyBriefingLogsScope(query, ctx);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return { briefing: data || null };
  }

  if (name === "list_briefings") {
    const limit = args.limit || 7;
    let query = supabase
      .from("briefing_logs")
      .select("id, date, content, task_count, created_at")
      .order("date", { ascending: false })
      .limit(limit);
    query = applyBriefingLogsScope(query, ctx);
    const { data, error } = await query;
    if (error) throw error;
    return { briefings: data || [] };
  }

  if (name === "save_reflection") {
    const entryDate = args.date || new Date().toISOString().split("T")[0];
    let findQuery = supabase
      .from("daily_reflections")
      .select("id")
      .eq("entry_date", entryDate);
    findQuery = applyDailyReflectionsScope(findQuery, ctx);
    const { data: existing, error: findError } = await findQuery.maybeSingle();
    if (findError) throw findError;

    const payload = { content: args.content, tags: args.tags || null };

    if (existing) {
      const { data, error } = await supabase
        .from("daily_reflections")
        .update(payload)
        .eq("id", existing.id)
        .select("id, entry_date, content, tags, created_at")
        .single();
      if (error) throw error;
      return { success: true, updated: true, reflection: data };
    }

    const row = scopedRowData(ctx, { entry_date: entryDate, ...payload });
    const { data, error } = await supabase
      .from("daily_reflections")
      .insert(row)
      .select("id, entry_date, content, tags, created_at")
      .single();
    if (error) throw error;
    return { success: true, updated: false, reflection: data };
  }

  if (name === "get_reflection") {
    const entryDate = args.date || new Date().toISOString().split("T")[0];
    let query = supabase
      .from("daily_reflections")
      .select("id, entry_date, content, tags, created_at")
      .eq("entry_date", entryDate);
    query = applyDailyReflectionsScope(query, ctx);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return { reflection: data || null };
  }

  if (name === "list_reflections") {
    const limit = args.limit || 7;
    const tagFilter = args.tags || args.tag || null;
    const fetchLimit = tagFilter ? Math.max(limit * 3, 30) : limit;
    let query = supabase
      .from("daily_reflections")
      .select("id, entry_date, content, tags, created_at")
      .order("entry_date", { ascending: false })
      .limit(fetchLimit);
    query = applyDailyReflectionsScope(query, ctx);
    const { data, error } = await query;
    if (error) throw error;
    let reflections = data || [];
    if (tagFilter) {
      reflections = filterByTags(reflections, tagFilter).slice(0, limit);
    }
    return { reflections };
  }

  if (name === "export_insights_to_dropbox") {
    let query = supabase
      .from("insights")
      .select("id, content, tags, created_at")
      .is("exported_at", null)
      .order("created_at", { ascending: true });
    query = applyInsightsScope(query, ctx);
    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      return { success: true, count: 0, message: "未エクスポートの気づきはありません" };
    }

    const csv = toCSV(data);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `insights_${date}.csv`;

    const dbx = new Dropbox({
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
    });

    const dropboxPath = (process.env.DROPBOX_EXPORT_PATH || "/insights").replace(/\/$/, "");

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

  if (name === "export_reflections_to_dropbox") {
    let query = supabase
      .from("daily_reflections")
      .select("id, entry_date, content, tags, created_at")
      .is("exported_at", null)
      .order("entry_date", { ascending: true });
    query = applyDailyReflectionsScope(query, ctx);
    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      return { success: true, count: 0, message: "未エクスポートの振り返りはありません" };
    }

    const csv = toReflectionCSV(data);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `reflections_${date}.csv`;

    const dbx = new Dropbox({
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
    });

    // 気づきエクスポートと同じ保存先（DROPBOX_EXPORT_PATH）に保存する
    const dropboxPath = (process.env.DROPBOX_EXPORT_PATH || "/insights").replace(/\/$/, "");

    await dbx.filesUpload({
      path: `${dropboxPath}/${filename}`,
      contents: Buffer.from(csv, "utf-8"),
      mode: { ".tag": "overwrite" },
    });

    const ids = data.map((r) => r.id);
    const { error: updateError } = await supabase
      .from("daily_reflections")
      .update({ exported_at: new Date().toISOString() })
      .in("id", ids);
    if (updateError) throw updateError;

    return { success: true, filename, count: data.length };
  }

  return { error: "unknown tool" };
}

module.exports = {
  executeTool,
  getWeekRange,
  parseInsightTags,
  filterInsightsByTags,
  filterByTags,
};
