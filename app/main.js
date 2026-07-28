/* -------------------------------------------------------
 * LIFF 設定
 * ----------------------------------------------------- */
const LIFF_ID = "2010175951-S9r18QtA";
let lineIdToken = null;
let currentMember = null;
let currentOrganization = null;

/* -------------------------------------------------------
 * 状態管理
 * ----------------------------------------------------- */
const STATE = {
  IDLE: "idle",
  TASK_NAME: "task_name",
  TASK_DUE: "task_due",
  TASK_PRIORITY: "task_priority",
  TASK_COMPLETE_NAME: "task_complete_name",
  TASK_COMPLETE_RESULT: "task_complete_result",
  TASK_UPDATE_PRIORITY_NAME: "task_update_priority_name",
  TASK_UPDATE_PRIORITY_SELECT: "task_update_priority_select",
  TASK_UPDATE_DUE_NAME: "task_update_due_name",
  TASK_UPDATE_DUE_DATE: "task_update_due_date",
  INSIGHT_CONTENT: "insight_content",
  INSIGHT_CATEGORY: "insight_category",
  PROMPT_TITLE: "prompt_title",
  PROMPT_CONTENT: "prompt_content",
  PROMPT_CATEGORY: "prompt_category",
  REFLECTION_CONTENT: "reflection_content",
};

let currentState = STATE.IDLE;
let flowData = {};

/* -------------------------------------------------------
 * DOM 参照
 * ----------------------------------------------------- */
const chatBody = document.getElementById("chat-body");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const loadingOverlay = document.getElementById("loading-overlay");

/* -------------------------------------------------------
 * ユーティリティ
 * ----------------------------------------------------- */
function nowStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dateToTimeStr(dateStr) {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function scrollBottom() {
  chatBody.scrollTop = chatBody.scrollHeight;
}

function authHeader() {
  try {
    const token = liff.getAccessToken() || lineIdToken;
    return token ? { "Authorization": `Bearer ${token}` } : {};
  } catch {
    return lineIdToken ? { "Authorization": `Bearer ${lineIdToken}` } : {};
  }
}

/* -------------------------------------------------------
 * メッセージ表示
 * ----------------------------------------------------- */
function addMessage(text, role, createdAt = null) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;

  if (role === "bot") {
    const av = document.createElement("div");
    av.className = "msg-avatar";
    av.textContent = "🤖";
    wrap.appendChild(av);
  }

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = createdAt ? dateToTimeStr(createdAt) : nowStr();

  if (role === "user") {
    wrap.appendChild(time);
    wrap.appendChild(bubble);
  } else {
    wrap.appendChild(bubble);
    wrap.appendChild(time);
  }

  chatBody.appendChild(wrap);
  scrollBottom();
}

function addTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg bot typing";
  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.textContent = "🤖";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = '<div class="dots"><span></span><span></span><span></span></div>';
  wrap.appendChild(av);
  wrap.appendChild(bubble);
  chatBody.appendChild(wrap);
  scrollBottom();
  return wrap;
}

/* -------------------------------------------------------
 * ボタン付きメッセージ
 * ----------------------------------------------------- */
function addBotMessageWithButtons(text, buttons, onSelect, multiSelect = false) {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.textContent = "🤖";
  wrap.appendChild(av);

  const group = document.createElement("div");
  group.className = "msg-bubble-group";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;
  group.appendChild(bubble);

  const btnWrap = document.createElement("div");
  btnWrap.className = "choice-buttons";

  const selected = new Set();

  function createCategoryBtn(label, value) {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = label;
    btn.dataset.value = value ?? label;
    btn.addEventListener("click", () => {
      if (selected.has(btn.dataset.value)) {
        selected.delete(btn.dataset.value);
        btn.classList.remove("selected");
      } else {
        selected.add(btn.dataset.value);
        btn.classList.add("selected");
      }
    });
    return btn;
  }

  buttons.forEach(({ label, value, className }) => {
    if (multiSelect) {
      btnWrap.appendChild(createCategoryBtn(label, value ?? label));
    } else {
      const btn = document.createElement("button");
      btn.className = `choice-btn ${className || ""}`;
      btn.textContent = label;
      btn.dataset.value = value ?? label;
      btn.addEventListener("click", () => {
        btnWrap.querySelectorAll(".choice-btn").forEach((b) => (b.disabled = true));
        btn.classList.add("selected");
        onSelect(btn.dataset.value);
      });
      btnWrap.appendChild(btn);
    }
  });

  /* ── カテゴリ追加ボタン（multiSelectのみ） ── */
  if (multiSelect) {
    const addBtn = document.createElement("button");
    addBtn.className = "choice-btn choice-btn-add";
    addBtn.textContent = "＋ カテゴリ追加";

    const addArea = document.createElement("div");
    addArea.className = "category-add-area";
    addArea.style.display = "none";

    const addInput = document.createElement("input");
    addInput.type = "text";
    addInput.className = "category-add-input";
    addInput.placeholder = "カテゴリ名を入力";
    addInput.maxLength = 20;

    const addConfirm = document.createElement("button");
    addConfirm.className = "category-add-confirm";
    addConfirm.textContent = "追加";

    function commitNewCategory() {
      const val = addInput.value.trim();
      if (!val) return;
      const newBtn = createCategoryBtn(val, val);
      newBtn.classList.add("selected");
      selected.add(val);
      btnWrap.insertBefore(newBtn, addBtn);
      addInput.value = "";
      addArea.style.display = "none";
      scrollBottom();
    }

    addConfirm.addEventListener("click", commitNewCategory);
    addInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitNewCategory(); }
    });

    addArea.appendChild(addInput);
    addArea.appendChild(addConfirm);

    addBtn.addEventListener("click", () => {
      addArea.style.display = addArea.style.display === "none" ? "flex" : "none";
      if (addArea.style.display === "flex") addInput.focus();
    });

    btnWrap.appendChild(addBtn);
    group.appendChild(btnWrap);
    group.appendChild(addArea);

    const submitBtn = document.createElement("button");
    submitBtn.className = "choice-submit-btn";
    submitBtn.textContent = "決定";
    submitBtn.addEventListener("click", () => {
      btnWrap.querySelectorAll(".choice-btn").forEach((b) => (b.disabled = true));
      addInput.disabled = true;
      addConfirm.disabled = true;
      submitBtn.disabled = true;
      onSelect([...selected]);
    });
    group.appendChild(submitBtn);
  } else {
    group.appendChild(btnWrap);
  }

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = nowStr();

  wrap.appendChild(group);
  wrap.appendChild(time);
  chatBody.appendChild(wrap);
  scrollBottom();
}

/* -------------------------------------------------------
 * 色付きタスクリスト表示
 * ----------------------------------------------------- */
function addTaskListMessage(tasks) {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.textContent = "🤖";
  wrap.appendChild(av);

  const group = document.createElement("div");
  group.className = "msg-bubble-group";

  const intro = document.createElement("div");
  intro.className = "msg-bubble";
  intro.textContent = tasks.length === 0
    ? "未完了のタスクはないよ！🎉"
    : `未完了タスク ${tasks.length} 件だよ📋`;
  group.appendChild(intro);

  if (tasks.length > 0) {
    const listWrap = document.createElement("div");
    listWrap.className = "task-list-bubble";

    tasks.forEach((task) => {
      const item = document.createElement("div");
      item.className = "task-item";

      const badge = document.createElement("span");
      const p = task.priority || "中";
      badge.className = `priority-badge priority-badge-${p === "高" ? "high" : p === "中" ? "mid" : "low"}`;
      badge.textContent = p;

      const title = document.createElement("span");
      title.className = "task-item-title";
      title.textContent = task.title;

      item.appendChild(badge);
      item.appendChild(title);

      if (task.due_date) {
        const d = new Date(task.due_date);
        const due = document.createElement("span");
        due.className = "task-item-due";
        due.textContent = `${d.getMonth() + 1}/${d.getDate()}まで`;
        item.appendChild(due);
      }

      listWrap.appendChild(item);
    });

    group.appendChild(listWrap);
  }

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = nowStr();

  wrap.appendChild(group);
  wrap.appendChild(time);
  chatBody.appendChild(wrap);
  scrollBottom();
}

const TAG_BADGE_CLASS = {
  "アイデア": "tag-badge-idea",
  "仕事": "tag-badge-work",
  "学び": "tag-badge-learn",
  "日常": "tag-badge-daily",
  "その他": "tag-badge-other",
  "文章作成": "tag-badge-writing",
  "コーディング": "tag-badge-coding",
  "分析": "tag-badge-analysis",
  "要約": "tag-badge-summary",
};

function parseInsightTags(tagsStr) {
  if (!tagsStr) return [];
  return String(tagsStr)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatInsightDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function truncateText(text, maxLen = 60) {
  const s = String(text || "");
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

/* -------------------------------------------------------
 * タグ付き気づきリスト表示
 * ----------------------------------------------------- */
function addInsightListMessage(insights, filterTag = null) {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.textContent = "🤖";
  wrap.appendChild(av);

  const group = document.createElement("div");
  group.className = "msg-bubble-group";

  const tagLabel = filterTag
    ? parseInsightTags(filterTag).join(" / ")
    : null;

  const intro = document.createElement("div");
  intro.className = "msg-bubble";
  if (insights.length === 0) {
    intro.textContent = tagLabel
      ? `「${tagLabel}」タグの気づきはまだないよ`
      : "気づきはまだないよ";
  } else {
    intro.textContent = tagLabel
      ? `「${tagLabel}」タグの気づき ${insights.length} 件だよ💡`
      : `気づき ${insights.length} 件だよ💡`;
  }
  group.appendChild(intro);

  if (insights.length > 0) {
    const listWrap = document.createElement("div");
    listWrap.className = "insight-list-bubble";

    insights.forEach((insight) => {
      const item = document.createElement("div");
      item.className = "insight-item";

      const tags = parseInsightTags(insight.tags);
      if (tags.length > 0) {
        const tagWrap = document.createElement("div");
        tagWrap.className = "insight-item-tags";
        tags.forEach((tag) => {
          const badge = document.createElement("span");
          badge.className = `tag-badge ${TAG_BADGE_CLASS[tag] || "tag-badge-other"}`;
          badge.textContent = tag;
          tagWrap.appendChild(badge);
        });
        item.appendChild(tagWrap);
      }

      const content = document.createElement("span");
      content.className = "insight-item-content";
      content.textContent = truncateText(insight.content);

      const date = document.createElement("span");
      date.className = "insight-item-date";
      date.textContent = formatInsightDate(insight.created_at);

      item.appendChild(content);
      item.appendChild(date);
      listWrap.appendChild(item);
    });

    group.appendChild(listWrap);
  }

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = nowStr();

  wrap.appendChild(group);
  wrap.appendChild(time);
  chatBody.appendChild(wrap);
  scrollBottom();
}

/* -------------------------------------------------------
 * 朝ブリーフィング表示
 * ----------------------------------------------------- */
function formatBriefingDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function addBriefingMessage(briefing) {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.textContent = "🤖";
  wrap.appendChild(av);

  const group = document.createElement("div");
  group.className = "msg-bubble-group";

  const intro = document.createElement("div");
  intro.className = "msg-bubble";
  if (!briefing) {
    intro.textContent = "この日のブリーフィングはまだないよ";
  } else {
    const countLabel =
      briefing.task_count != null ? `（未完了 ${briefing.task_count} 件）` : "";
    intro.textContent = `🌅 ${formatBriefingDate(briefing.date)} の朝ブリーフィング${countLabel}`;
  }
  group.appendChild(intro);

  if (briefing && briefing.content) {
    const card = document.createElement("div");
    card.className = "briefing-card";
    card.textContent = briefing.content;
    group.appendChild(card);
  }

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = nowStr();

  wrap.appendChild(group);
  wrap.appendChild(time);
  chatBody.appendChild(wrap);
  scrollBottom();
}

function addBriefingListMessage(briefings) {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.textContent = "🤖";
  wrap.appendChild(av);

  const group = document.createElement("div");
  group.className = "msg-bubble-group";

  const intro = document.createElement("div");
  intro.className = "msg-bubble";
  intro.textContent =
    briefings.length === 0
      ? "ブリーフィングの履歴はまだないよ"
      : `直近のブリーフィング ${briefings.length} 件だよ🌅`;
  group.appendChild(intro);

  if (briefings.length > 0) {
    const listWrap = document.createElement("div");
    listWrap.className = "briefing-list-bubble";

    briefings.forEach((item) => {
      const row = document.createElement("div");
      row.className = "briefing-list-item";

      const head = document.createElement("div");
      head.className = "briefing-list-head";
      const countLabel =
        item.task_count != null ? ` · タスク ${item.task_count} 件` : "";
      head.textContent = `${formatBriefingDate(item.date)}${countLabel}`;

      const body = document.createElement("div");
      body.className = "briefing-list-content";
      body.textContent = truncateText(item.content, 120);

      row.appendChild(head);
      row.appendChild(body);
      listWrap.appendChild(row);
    });

    group.appendChild(listWrap);
  }

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = nowStr();

  wrap.appendChild(group);
  wrap.appendChild(time);
  chatBody.appendChild(wrap);
  scrollBottom();
}

/* -------------------------------------------------------
 * 今日の振り返り表示
 * ----------------------------------------------------- */
function formatReflectionDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function addReflectionMessage(reflection) {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.textContent = "🤖";
  wrap.appendChild(av);

  const group = document.createElement("div");
  group.className = "msg-bubble-group";

  const intro = document.createElement("div");
  intro.className = "msg-bubble";
  if (!reflection) {
    intro.textContent = "この日の振り返りはまだないよ";
  } else {
    intro.textContent = `📝 ${formatReflectionDate(reflection.entry_date)} の振り返りを記録したよ`;
  }
  group.appendChild(intro);

  if (reflection && reflection.content) {
    const card = document.createElement("div");
    card.className = "reflection-card";
    card.textContent = reflection.content;
    group.appendChild(card);
  }

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = nowStr();

  wrap.appendChild(group);
  wrap.appendChild(time);
  chatBody.appendChild(wrap);
  scrollBottom();
}

function addReflectionListMessage(reflections) {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.textContent = "🤖";
  wrap.appendChild(av);

  const group = document.createElement("div");
  group.className = "msg-bubble-group";

  const intro = document.createElement("div");
  intro.className = "msg-bubble";
  intro.textContent =
    reflections.length === 0
      ? "振り返りの履歴はまだないよ"
      : `直近の振り返り ${reflections.length} 件だよ📝`;
  group.appendChild(intro);

  if (reflections.length > 0) {
    const listWrap = document.createElement("div");
    listWrap.className = "reflection-list-bubble";

    reflections.forEach((item) => {
      const row = document.createElement("div");
      row.className = "reflection-list-item";

      const head = document.createElement("div");
      head.className = "reflection-list-head";
      head.textContent = formatReflectionDate(item.entry_date);

      const body = document.createElement("div");
      body.className = "reflection-list-content";
      body.textContent = truncateText(item.content, 120);

      row.appendChild(head);
      row.appendChild(body);
      listWrap.appendChild(row);
    });

    group.appendChild(listWrap);
  }

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = nowStr();

  wrap.appendChild(group);
  wrap.appendChild(time);
  chatBody.appendChild(wrap);
  scrollBottom();
}

/* -------------------------------------------------------
 * タグ付きプロンプトリスト表示
 * ----------------------------------------------------- */
function addPromptListMessage(prompts, filterTag = null) {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.textContent = "🤖";
  wrap.appendChild(av);

  const group = document.createElement("div");
  group.className = "msg-bubble-group";

  const tagLabel = filterTag
    ? parseInsightTags(filterTag).join(" / ")
    : null;

  const intro = document.createElement("div");
  intro.className = "msg-bubble";
  if (prompts.length === 0) {
    intro.textContent = tagLabel
      ? `「${tagLabel}」タグのプロンプトはまだないよ`
      : "プロンプトはまだないよ";
  } else {
    intro.textContent = tagLabel
      ? `「${tagLabel}」タグのプロンプト ${prompts.length} 件だよ✨`
      : `プロンプト ${prompts.length} 件だよ✨`;
  }
  group.appendChild(intro);

  if (prompts.length > 0) {
    const listWrap = document.createElement("div");
    listWrap.className = "prompt-list-bubble";

    prompts.forEach((prompt) => {
      const item = document.createElement("div");
      item.className = "prompt-item";

      const tags = parseInsightTags(prompt.tags);
      if (tags.length > 0) {
        const tagWrap = document.createElement("div");
        tagWrap.className = "insight-item-tags";
        tags.forEach((tag) => {
          const badge = document.createElement("span");
          badge.className = `tag-badge ${TAG_BADGE_CLASS[tag] || "tag-badge-other"}`;
          badge.textContent = tag;
          tagWrap.appendChild(badge);
        });
        item.appendChild(tagWrap);
      }

      const title = document.createElement("div");
      title.className = "prompt-item-title";
      title.textContent = prompt.title;

      const content = document.createElement("div");
      content.className = "prompt-item-content";
      content.textContent = truncateText(prompt.content, 80);

      const date = document.createElement("span");
      date.className = "insight-item-date";
      date.textContent = formatInsightDate(prompt.created_at);

      item.appendChild(title);
      item.appendChild(content);
      item.appendChild(date);
      listWrap.appendChild(item);
    });

    group.appendChild(listWrap);
  }

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = nowStr();

  wrap.appendChild(group);
  wrap.appendChild(time);
  chatBody.appendChild(wrap);
  scrollBottom();
}

/* -------------------------------------------------------
 * API 呼び出し
 * ----------------------------------------------------- */
async function callChat(message) {
  const typing = addTyping();
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    typing.remove();
    if (!res.ok) {
      addMessage(`エラー: ${data.error || "不明なエラー"}`, "bot");
    } else if (data.tasks !== undefined) {
      addTaskListMessage(data.tasks);
    } else {
      if (data.reply) addMessage(data.reply, "bot");
      if (data.insights !== undefined) {
        addInsightListMessage(data.insights, data.insightTag);
      }
      if (data.prompts !== undefined) {
        addPromptListMessage(data.prompts, data.promptTag);
      }
      if (data.briefing !== undefined) {
        addBriefingMessage(data.briefing);
      }
      if (data.briefings !== undefined) {
        addBriefingListMessage(data.briefings);
      }
      if (data.reflection !== undefined) {
        addReflectionMessage(data.reflection);
      }
      if (data.reflections !== undefined) {
        addReflectionListMessage(data.reflections);
      }
    }
  } catch (err) {
    typing.remove();
    addMessage("通信エラーが発生しました", "bot");
    console.error(err);
  }
}

async function fetchTasks() {
  try {
    const res = await fetch("/api/tasks", {
      headers: { ...authHeader() },
    });
    const data = await res.json();
    return data.tasks || [];
  } catch {
    return [];
  }
}

async function addTaskDirect(title, dueDate, priority) {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify({
      title,
      due_date: dueDate || null,
      priority,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "タスクの追加に失敗しました");
  }
  return data.task;
}

async function completeTaskById(taskId, result) {
  const res = await fetch("/api/tasks", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify({
      id: taskId,
      action: "complete",
      result: result || null,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "タスクの完了に失敗しました");
  }
  return data;
}

function formatTaskLabel(task) {
  const icon = task.priority === "高" ? "🔴" : task.priority === "中" ? "🟡" : "🔵";
  const due = task.due_date
    ? ` (${new Date(task.due_date).getMonth() + 1}/${new Date(task.due_date).getDate()})`
    : "";
  return `${icon} ${task.title}${due}`;
}

async function fetchCategories(content, type = "insight") {
  const defaults = type === "prompt"
    ? ["文章作成", "コーディング", "分析", "要約", "その他"]
    : ["仕事", "学び", "アイデア", "日常", "その他"];
  try {
    const res = await fetch("/api/suggest-categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({ content, type }),
    });
    const data = await res.json();
    return data.categories || defaults;
  } catch {
    return defaults;
  }
}

/* -------------------------------------------------------
 * 入力有効 / 無効
 * ----------------------------------------------------- */
function setInputEnabled(enabled) {
  userInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
  if (enabled) userInput.focus();
}

/* -------------------------------------------------------
 * フロー開始
 * ----------------------------------------------------- */
function startTaskFlow() {
  currentState = STATE.TASK_NAME;
  flowData = {};
  setInputEnabled(true);
  addMessage("タスク名を教えてください😊", "bot");
}

function startInsightFlow() {
  currentState = STATE.INSIGHT_CONTENT;
  flowData = {};
  setInputEnabled(true);
  addMessage("気づきを入力してください📝", "bot");
}

function startPromptFlow() {
  currentState = STATE.PROMPT_TITLE;
  flowData = {};
  setInputEnabled(true);
  addMessage("プロンプトのタイトルを入力してください✨", "bot");
}

function startReflectionFlow() {
  currentState = STATE.REFLECTION_CONTENT;
  flowData = {};
  setInputEnabled(true);
  addMessage("今日の振り返りを入力してください📝\n（同じ日にもう一度記録すると上書きされます）", "bot");
}

async function startCompleteFlow() {
  flowData = {};
  setInputEnabled(false);
  const typing = addTyping();
  const tasks = await fetchTasks();
  typing.remove();

  if (tasks.length === 0) {
    addMessage("未完了のタスクはないよ！🎉", "bot");
    setInputEnabled(true);
    return;
  }

  addBotMessageWithButtons(
    "完了にするタスクを選んでください✅",
    tasks.map((t) => ({ label: formatTaskLabel(t), value: t.id })),
    (taskId) => {
      const task = tasks.find((t) => t.id === taskId);
      flowData.completeTaskId = taskId;
      flowData.completeTitle = task ? task.title : taskId;
      addMessage(flowData.completeTitle, "user");
      currentState = STATE.TASK_COMPLETE_RESULT;
      setInputEnabled(true);
      addMessage("どんな結果でしたか？\n「なし」でスキップもできます", "bot");
    }
  );
}

async function startUpdatePriorityFlow() {
  flowData = {};
  setInputEnabled(false);
  const typing = addTyping();
  const tasks = await fetchTasks();
  typing.remove();

  if (tasks.length === 0) {
    addMessage("未完了のタスクはないよ！🎉", "bot");
    setInputEnabled(true);
    return;
  }

  addBotMessageWithButtons(
    "優先度を変更するタスクを選んでください🔄",
    tasks.map((t) => ({ label: formatTaskLabel(t), value: t.title })),
    (value) => {
      flowData.updateTitle = value;
      addMessage(value, "user");
      currentState = STATE.TASK_UPDATE_PRIORITY_SELECT;
      addBotMessageWithButtons(
        "新しい優先度を選んでください",
        [
          { label: "🔴 高", value: "高", className: "priority-high" },
          { label: "🟡 中", value: "中", className: "priority-mid" },
          { label: "🟢 低", value: "低", className: "priority-low" },
        ],
        async (priority) => {
          addMessage(priority, "user");
          currentState = STATE.IDLE;
          await callChat(`「${flowData.updateTitle}」の優先度を${priority}に変更して`);
          setInputEnabled(true);
        }
      );
    }
  );
}

async function startUpdateDueFlow() {
  flowData = {};
  setInputEnabled(false);
  const typing = addTyping();
  const tasks = await fetchTasks();
  typing.remove();

  if (tasks.length === 0) {
    addMessage("未完了のタスクはないよ！🎉", "bot");
    setInputEnabled(true);
    return;
  }

  addBotMessageWithButtons(
    "期日を変更するタスクを選んでください📅",
    tasks.map((t) => ({ label: formatTaskLabel(t), value: t.title })),
    (value) => {
      flowData.updateTitle = value;
      addMessage(value, "user");
      currentState = STATE.TASK_UPDATE_DUE_DATE;
      setInputEnabled(true);
      addMessage("新しい期日を教えてください\n例）6/10\n削除する場合は「なし」と入力してください", "bot");
    }
  );
}

async function showTaskList() {
  addMessage("タスク一覧", "user");
  const typing = addTyping();
  try {
    const tasks = await fetchTasks();
    typing.remove();
    addTaskListMessage(tasks);
  } catch (err) {
    typing.remove();
    addMessage("タスクの取得に失敗しました", "bot");
    console.error(err);
  }
}

/* -------------------------------------------------------
 * ユーザー入力処理（ステートマシン）
 * ----------------------------------------------------- */
async function handleUserInput(text) {
  if (!text) return;

  userInput.value = "";
  userInput.style.height = "auto";
  addMessage(text, "user");

  /* ── 通常モード ── */
  if (currentState === STATE.IDLE) {
    setInputEnabled(false);
    await callChat(text);
    setInputEnabled(true);
    return;
  }

  /* ── タスク名入力 ── */
  if (currentState === STATE.TASK_NAME) {
    flowData.title = text;
    currentState = STATE.TASK_DUE;
    addMessage("期限はいつまで？\n例）5/30\nない場合は「なし」と入力してください", "bot");
    return;
  }

  /* ── 期限入力 ── */
  if (currentState === STATE.TASK_DUE) {
    flowData.dueDate = text === "なし" ? null : text;
    currentState = STATE.TASK_PRIORITY;
    setInputEnabled(false);
    addBotMessageWithButtons(
      "優先度を選んでください",
      [
        { label: "🔴 高", value: "高", className: "priority-high" },
        { label: "🟡 中", value: "中", className: "priority-mid" },
        { label: "🟢 低", value: "低", className: "priority-low" },
      ],
      async (value) => {
        flowData.priority = value;
        addMessage(value, "user");
        currentState = STATE.IDLE;
        const typing = addTyping();
        try {
          const task = await addTaskDirect(
            flowData.title,
            flowData.dueDate,
            flowData.priority
          );
          typing.remove();
          const dueLabel = task.due_date
            ? `（期限: ${new Date(task.due_date).getMonth() + 1}/${new Date(task.due_date).getDate()}）`
            : "";
          addMessage(
            `「${task.title}」を追加したよ！📌 優先度: ${task.priority}${dueLabel}`,
            "bot"
          );
        } catch (err) {
          typing.remove();
          addMessage(`エラー: ${err.message}`, "bot");
          console.error(err);
        }
        setInputEnabled(true);
      }
    );
    return;
  }

  /* ── タスク完了：結果入力 ── */
  if (currentState === STATE.TASK_COMPLETE_RESULT) {
    flowData.completeResult = text === "なし" ? null : text;
    currentState = STATE.IDLE;
    setInputEnabled(false);
    const typing = addTyping();
    try {
      const data = await completeTaskById(flowData.completeTaskId, flowData.completeResult);
      typing.remove();
      const resultMsg = flowData.completeResult
        ? `\n📝 ${flowData.completeResult}`
        : "";
      addMessage(`「${data.title}」を完了にしたよ！✅${resultMsg}`, "bot");
    } catch (err) {
      typing.remove();
      addMessage(`エラー: ${err.message}`, "bot");
      console.error(err);
    }
    setInputEnabled(true);
    return;
  }

  /* ── 期日修正：日付入力 ── */
  if (currentState === STATE.TASK_UPDATE_DUE_DATE) {
    const newDue = text === "なし" ? "なし" : text;
    currentState = STATE.IDLE;
    await callChat(`「${flowData.updateTitle}」の期日を${newDue}に変更して`);
    setInputEnabled(true);
    return;
  }

  /* ── 気づき入力 ── */
  if (currentState === STATE.INSIGHT_CONTENT) {
    flowData.content = text;
    currentState = STATE.INSIGHT_CATEGORY;
    setInputEnabled(false);
    const typing = addTyping();
    const categories = await fetchCategories(text);
    typing.remove();
    addBotMessageWithButtons(
      "カテゴリを選んでください（複数選択可）",
      categories.map((c) => ({ label: c, value: c })),
      async (selected) => {
        const tags = Array.isArray(selected) ? selected.join(",") : selected;
        const label = Array.isArray(selected) && selected.length > 0
          ? selected.join(" / ")
          : "なし";
        addMessage(`カテゴリ: ${label}`, "user");
        currentState = STATE.IDLE;
        await callChat(
          `気づきを記録：${flowData.content}${tags ? `、タグ: ${tags}` : ""}`
        );
        setInputEnabled(true);
      },
      true
    );
    return;
  }

  /* ── プロンプト：タイトル入力 ── */
  if (currentState === STATE.PROMPT_TITLE) {
    flowData.title = text;
    currentState = STATE.PROMPT_CONTENT;
    addMessage("プロンプト本文を入力してください📋", "bot");
    return;
  }

  /* ── プロンプト：本文入力 ── */
  if (currentState === STATE.PROMPT_CONTENT) {
    flowData.content = text;
    currentState = STATE.PROMPT_CATEGORY;
    setInputEnabled(false);
    const typing = addTyping();
    const categories = await fetchCategories(
      `${flowData.title}\n${flowData.content}`,
      "prompt"
    );
    typing.remove();
    addBotMessageWithButtons(
      "カテゴリを選んでください（複数選択可）",
      categories.map((c) => ({ label: c, value: c })),
      async (selected) => {
        const tags = Array.isArray(selected) ? selected.join(",") : selected;
        const label = Array.isArray(selected) && selected.length > 0
          ? selected.join(" / ")
          : "なし";
        addMessage(`カテゴリ: ${label}`, "user");
        currentState = STATE.IDLE;
        await callChat(
          `プロンプトを記録：タイトル「${flowData.title}」、本文「${flowData.content}」${tags ? `、タグ: ${tags}` : ""}`
        );
        setInputEnabled(true);
      },
      true
    );
    return;
  }

  /* ── 今日の振り返り入力 ── */
  if (currentState === STATE.REFLECTION_CONTENT) {
    flowData.content = text;
    currentState = STATE.IDLE;
    setInputEnabled(false);
    await callChat(`今日の振り返りを記録：${flowData.content}`);
    setInputEnabled(true);
    return;
  }
}

/* -------------------------------------------------------
 * 音声入力
 * ----------------------------------------------------- */
let mediaRecorder = null;
let recordingStream = null;
let recordedChunks = [];
let isRecording = false;
let isTranscribing = false;
let micUnavailableReason = "";
let hasShownLiffMicHint = false;

function updateInputHeight() {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
}

function resetMicUi() {
  isRecording = false;
  micBtn.classList.remove("recording");
  micBtn.title = "音声入力";
  userInput.placeholder = "メッセージを入力...";
}

function showMicUnavailable(reason) {
  micUnavailableReason = reason;
  micBtn.disabled = true;
  micBtn.style.opacity = "0.45";
  micBtn.style.cursor = "not-allowed";
  micBtn.title = "音声入力はこの環境で利用できません";
}

function stopRecordingStream() {
  if (!recordingStream) return;
  recordingStream.getTracks().forEach((track) => track.stop());
  recordingStream = null;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function transcribeAudio(blob) {
  const audioBase64 = await blobToBase64(blob);
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || "audio/webm",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "音声の文字起こしに失敗しました");
  return (data.text || "").trim();
}

async function startRecording() {
  if (isRecording || isTranscribing) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMicUnavailable("このブラウザは音声入力に対応していないため、テキスト入力をご利用ください。");
    addMessage(micUnavailableReason, "bot");
    return;
  }

  if (!window.MediaRecorder) {
    showMicUnavailable("この端末は録音機能に対応していないため、テキスト入力をご利用ください。");
    addMessage(micUnavailableReason, "bot");
    return;
  }

  if (!hasShownLiffMicHint && typeof liff !== "undefined" && liff.isInClient()) {
    hasShownLiffMicHint = true;
    addMessage("LINE内ブラウザでは初回にマイク許可ダイアログが表示されます。許可してから録音してください。", "bot");
  }

  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(recordingStream);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) recordedChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", async () => {
      const chunkType = recordedChunks[0]?.type || "audio/webm";
      const blob = new Blob(recordedChunks, { type: chunkType });
      stopRecordingStream();
      resetMicUi();

      if (blob.size === 0) {
        addMessage("録音データが取得できませんでした。もう一度お試しください。", "bot");
        return;
      }

      isTranscribing = true;
      userInput.placeholder = "音声を文字起こし中...";
      try {
        const text = await transcribeAudio(blob);
        if (!text) {
          addMessage("音声を認識できませんでした。もう少し大きな声でお試しください。", "bot");
          return;
        }
        userInput.value = text;
        updateInputHeight();
        userInput.focus();
      } catch (err) {
        addMessage(`文字起こしに失敗しました。${err.message}`, "bot");
      } finally {
        isTranscribing = false;
        userInput.placeholder = "メッセージを入力...";
      }
    });

    mediaRecorder.start();
    isRecording = true;
    micBtn.classList.add("recording");
    micBtn.title = "録音中（タップで停止）";
    userInput.placeholder = "録音中...";
  } catch (err) {
    stopRecordingStream();
    resetMicUi();
    const errorName = err && err.name ? err.name : "unknown";
    if (errorName === "NotAllowedError" || errorName === "SecurityError") {
      addMessage("マイクの使用が許可されていません。LINEアプリと端末の権限設定をご確認ください。", "bot");
      return;
    }
    if (errorName === "NotReadableError" || errorName === "AbortError") {
      addMessage("マイクを利用できませんでした。端末の通話中・録音中アプリを終了して再試行してください。", "bot");
      return;
    }
    addMessage(`録音を開始できませんでした（${errorName}）。テキスト入力をご利用ください。`, "bot");
  }
}

function stopRecording() {
  if (!isRecording || !mediaRecorder) return;
  try {
    mediaRecorder.stop();
  } catch {
    stopRecordingStream();
    resetMicUi();
  }
}

if (!window.MediaRecorder) {
  showMicUnavailable("この端末は録音機能に対応していないため、テキスト入力をご利用ください。");
}

micBtn.addEventListener("click", async () => {
  if (micUnavailableReason) {
    addMessage(micUnavailableReason, "bot");
    return;
  }
  if (isTranscribing) {
    addMessage("文字起こし中です。完了までお待ちください。", "bot");
    return;
  }
  if (isRecording) stopRecording();
  else await startRecording();
});

/* -------------------------------------------------------
 * イベントリスナー
 * ----------------------------------------------------- */
sendBtn.addEventListener("click", () => handleUserInput(userInput.value.trim()));

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    handleUserInput(userInput.value.trim());
  }
});

userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
});

document.getElementById("qa-task").addEventListener("click", startTaskFlow);
document.getElementById("qa-insight").addEventListener("click", startInsightFlow);
document.getElementById("qa-prompt").addEventListener("click", startPromptFlow);
document.getElementById("qa-list").addEventListener("click", showTaskList);
document.getElementById("qa-complete").addEventListener("click", startCompleteFlow);
document.getElementById("qa-update-priority").addEventListener("click", startUpdatePriorityFlow);
document.getElementById("qa-update-due").addEventListener("click", startUpdateDueFlow);
document.getElementById("qa-export").addEventListener("click", async () => {
  addMessage("気づきエクスポート", "user");
  await callChat("気づきをエクスポートして");
});
document.getElementById("qa-briefing").addEventListener("click", async () => {
  addMessage("朝ブリーフィング", "user");
  await callChat(
    "朝ブリーフィングを作成して。未完了タスクを確認し、今日の要点をまとめて保存して"
  );
});
document.getElementById("qa-reflection").addEventListener("click", startReflectionFlow);

/* -------------------------------------------------------
 * メンバー認証（Phase 1: 招待紐づけ / auth/me）
 * ----------------------------------------------------- */
function getInviteCodeFromUrl() {
  return new URLSearchParams(location.search).get("invite");
}

function clearInviteFromUrl() {
  const url = new URL(location.href);
  url.searchParams.delete("invite");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

async function activateInvite(inviteCode) {
  const res = await fetch("/api/auth/activate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify({ invite: inviteCode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "招待の登録に失敗しました");
  return data;
}

async function fetchAuthMe() {
  const res = await fetch("/api/auth/me", {
    headers: { ...authHeader() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "認証情報の取得に失敗しました");
  return data;
}

/** ヘッダーに organizations.name を表示 */
function updateHeaderOrganization(org) {
  const el = document.getElementById("header-org-name");
  if (!el) return;
  const name =
    org && org.name != null ? String(org.name).trim() : "";
  if (name) {
    el.textContent = name;
    el.title = name;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.title = "";
    el.hidden = true;
  }
}

async function refreshHeaderOrganizationFromApi() {
  try {
    const me = await fetchAuthMe();
    if (!me.legacy && me.organization) {
      currentOrganization = me.organization;
      updateHeaderOrganization(me.organization);
    }
  } catch (e) {
    console.warn("refreshHeaderOrganization:", e);
  }
}

function showOrgSetupNotice(organization) {
  updateHeaderOrganization(organization);
  const name = organization?.name || "ご所属の法人";
  addMessage(
    `${name} の代表管理者として登録されました。\n右上の ⚙️ から組織階層の設定を行ってください。`,
    "bot"
  );
}

function initOrgAdminFromAuth(me) {
  if (typeof window.initOrgAdmin === "function") {
    window.initOrgAdmin(me);
  }
}

/* -------------------------------------------------------
 * チャット履歴の読み込み
 * ----------------------------------------------------- */
function addHistorySeparator(label) {
  const sep = document.createElement("div");
  sep.className = "history-separator";
  sep.textContent = label;
  chatBody.appendChild(sep);
}

async function loadHistory() {
  try {
    const res = await fetch("/api/messages", {
      headers: { ...authHeader() },
    });
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    const msgs = data.messages || [];

    if (msgs.length === 0) {
      addMessage("こんにちは！何でも話しかけてね😊", "bot");
      return;
    }

    addHistorySeparator("─── 過去の会話（12時間以内）───");
    msgs.forEach((msg) => addMessage(msg.content, msg.role, msg.created_at));
    addHistorySeparator("─── ここから新しい会話 ───");
  } catch (e) {
    console.error("履歴取得エラー:", e);
    addMessage("こんにちは！何でも話しかけてね😊", "bot");
  }
}

/* -------------------------------------------------------
 * LIFF 初期化（ページ起動時）
 * ----------------------------------------------------- */
async function initLiff() {
  try {
    await liff.init({ liffId: LIFF_ID });

    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href });
      return;
    }

    lineIdToken = liff.getAccessToken();

    /* LINEプロフィールをヘッダーに表示 */
    liff.getProfile().then((profile) => {
      const icon = document.getElementById("header-user-icon");
      const name = document.getElementById("header-user-name");
      if (profile.pictureUrl) {
        icon.src = profile.pictureUrl;
        icon.style.display = "block";
      }
      name.textContent = profile.displayName;
    }).catch(() => {});

    const inviteCode = getInviteCodeFromUrl();
    if (inviteCode) {
      try {
        const activated = await activateInvite(inviteCode);
        currentMember = activated.member;
        currentOrganization = activated.organization;
        updateHeaderOrganization(activated.organization);
        clearInviteFromUrl();
        addMessage("登録が完了しました。BrainDump をご利用いただけます。", "bot");
        if (activated.needsOrgSetup) {
          showOrgSetupNotice(activated.organization);
        }
        initOrgAdminFromAuth({
          legacy: false,
          member: activated.member,
          organization: activated.organization,
          needsOrgSetup: activated.needsOrgSetup,
        });
      } catch (activateErr) {
        loadingOverlay.style.display = "none";
        addMessage(`招待の登録に失敗しました: ${activateErr.message}`, "bot");
        return;
      }
    } else {
      try {
        const me = await fetchAuthMe();
        if (!me.legacy && me.member) {
          currentMember = me.member;
          currentOrganization = me.organization;
          updateHeaderOrganization(me.organization);
          if (me.needsOrgSetup) {
            showOrgSetupNotice(me.organization);
          }
          initOrgAdminFromAuth(me);
        }
      } catch (meErr) {
        console.warn("auth/me:", meErr);
      }
    }

    loadingOverlay.style.display = "none";
    await loadHistory();
    await refreshHeaderOrganizationFromApi();

  } catch (e) {
    console.error("LIFF init error:", e);
    loadingOverlay.style.display = "none";
    addMessage("⚠️ 認証エラーが発生しました。LINEからアクセスしてください。", "bot");
  }
}

window.addEventListener("org-setup-complete", async () => {
  try {
    const me = await fetchAuthMe();
    if (!me.legacy && me.organization) {
      currentOrganization = me.organization;
      updateHeaderOrganization(me.organization);
    }
  } catch (e) {
    console.warn("org-setup-complete:", e);
  }
});

initLiff();
