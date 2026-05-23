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
  INSIGHT_CONTENT: "insight_content",
  INSIGHT_CATEGORY: "insight_category",
};

let currentState = STATE.IDLE;
let flowData = {};

/* -------------------------------------------------------
 * DOM 参照
 * ----------------------------------------------------- */
const chatBody = document.getElementById("chat-body");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

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

/* -------------------------------------------------------
 * API 呼び出し
 * ----------------------------------------------------- */
async function callChat(message) {
  const typing = addTyping();
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    typing.remove();
    if (!res.ok) {
      addMessage(`エラー: ${data.error || "不明なエラー"}`, "bot");
    } else if (data.tasks !== undefined) {
      addTaskListMessage(data.tasks);
    } else {
      addMessage(data.reply, "bot");
    }
  } catch (err) {
    typing.remove();
    addMessage("通信エラーが発生しました", "bot");
    console.error(err);
  }
}

async function fetchCategories(content) {
  try {
    const res = await fetch("/api/suggest-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    return data.categories || ["仕事", "学び", "アイデア", "日常", "その他"];
  } catch {
    return ["仕事", "学び", "アイデア", "日常", "その他"];
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

function startCompleteFlow() {
  currentState = STATE.TASK_COMPLETE_NAME;
  flowData = {};
  setInputEnabled(true);
  addMessage("完了にするタスク名を教えてください✅", "bot");
}

async function showTaskList() {
  addMessage("タスク一覧", "user");
  await callChat("未完了のタスクをすべて表示して");
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
        const due = flowData.dueDate ? `、期限${flowData.dueDate}` : "";
        await callChat(
          `「${flowData.title}」のタスクを追加して${due}、優先度は${flowData.priority}`
        );
        setInputEnabled(true);
      }
    );
    return;
  }

  /* ── タスク完了：タスク名入力 ── */
  if (currentState === STATE.TASK_COMPLETE_NAME) {
    flowData.completeTitle = text;
    currentState = STATE.TASK_COMPLETE_RESULT;
    addMessage("どんな結果でしたか？\n「なし」でスキップもできます", "bot");
    return;
  }

  /* ── タスク完了：結果入力 ── */
  if (currentState === STATE.TASK_COMPLETE_RESULT) {
    flowData.completeResult = text === "なし" ? null : text;
    currentState = STATE.IDLE;
    const resultPart = flowData.completeResult ? `、結果: ${flowData.completeResult}` : "";
    await callChat(`「${flowData.completeTitle}」を完了にして${resultPart}`);
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
}

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
document.getElementById("qa-list").addEventListener("click", showTaskList);
document.getElementById("qa-complete").addEventListener("click", startCompleteFlow);
document.getElementById("qa-export").addEventListener("click", async () => {
  addMessage("気づきエクスポート", "user");
  await callChat("気づきをエクスポートして");
});

/* -------------------------------------------------------
 * チャット履歴の読み込み（ページ初期化）
 * ----------------------------------------------------- */
function addHistorySeparator(label) {
  const sep = document.createElement("div");
  sep.className = "history-separator";
  sep.textContent = label;
  chatBody.appendChild(sep);
}

async function loadHistory() {
  try {
    const res = await fetch("/api/messages");
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    const msgs = data.messages || [];

    if (msgs.length === 0) {
      // 履歴なし → 初回挨拶
      addMessage("こんにちは！何でも話しかけてね😊", "bot");
      return;
    }

    // 履歴あり → セパレーターの後に表示
    addHistorySeparator("─── 過去の会話（12時間以内）───");
    msgs.forEach((msg) => addMessage(msg.content, msg.role, msg.created_at));
    addHistorySeparator("─── ここから新しい会話 ───");
  } catch (e) {
    console.error("履歴取得エラー:", e);
    // エラー時も初回挨拶を表示
    addMessage("こんにちは！何でも話しかけてね😊", "bot");
  }
}

loadHistory();
