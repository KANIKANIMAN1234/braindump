/* -------------------------------------------------------
 * LIFF 設定
 * ----------------------------------------------------- */
const LIFF_ID = "2010175951-S9r18QtA";
let lineIdToken = null;

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
  return lineIdToken ? { "Authorization": `Bearer ${lineIdToken}` } : {};
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
      addMessage(data.reply, "bot");
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

function formatTaskLabel(task) {
  const icon = task.priority === "高" ? "🔴" : task.priority === "中" ? "🟡" : "🔵";
  const due = task.due_date
    ? ` (${new Date(task.due_date).getMonth() + 1}/${new Date(task.due_date).getDate()})`
    : "";
  return `${icon} ${task.title}${due}`;
}

async function fetchCategories(content) {
  try {
    const res = await fetch("/api/suggest-categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
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
    tasks.map((t) => ({ label: formatTaskLabel(t), value: t.title })),
    (value) => {
      flowData.completeTitle = value;
      addMessage(value, "user");
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

  /* ── タスク完了：結果入力 ── */
  if (currentState === STATE.TASK_COMPLETE_RESULT) {
    flowData.completeResult = text === "なし" ? null : text;
    currentState = STATE.IDLE;
    const resultPart = flowData.completeResult ? `、結果: ${flowData.completeResult}` : "";
    await callChat(`「${flowData.completeTitle}」を完了にして${resultPart}`);
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
}

/* -------------------------------------------------------
 * 音声入力
 * ----------------------------------------------------- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add("recording");
    micBtn.title = "録音中（タップで停止）";
    userInput.placeholder = "音声を認識中...";
  };

  recognition.onresult = (event) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += text;
      } else {
        interim += text;
      }
    }
    userInput.value = final || interim;
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
    micBtn.title = "音声入力";
    userInput.placeholder = "メッセージを入力...";
    if (userInput.value.trim()) {
      userInput.focus();
    }
  };

  recognition.onerror = (event) => {
    isRecording = false;
    micBtn.classList.remove("recording");
    micBtn.title = "音声入力";
    userInput.placeholder = "メッセージを入力...";
    if (event.error === "not-allowed") {
      addMessage("マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。", "bot");
    }
  };

  micBtn.addEventListener("click", () => {
    if (isRecording) {
      recognition.stop();
    } else {
      userInput.value = "";
      recognition.start();
    }
  });
} else {
  micBtn.style.display = "none";
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
document.getElementById("qa-update-priority").addEventListener("click", startUpdatePriorityFlow);
document.getElementById("qa-update-due").addEventListener("click", startUpdateDueFlow);
document.getElementById("qa-export").addEventListener("click", async () => {
  addMessage("気づきエクスポート", "user");
  await callChat("気づきをエクスポートして");
});

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
      liff.login();
      return;
    }

    lineIdToken = liff.getIDToken();

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

    loadingOverlay.style.display = "none";
    await loadHistory();

  } catch (e) {
    console.error("LIFF init error:", e);
    loadingOverlay.style.display = "none";
    addMessage("⚠️ 認証エラーが発生しました。LINEからアクセスしてください。", "bot");
  }
}

initLiff();
