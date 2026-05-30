const SECRET_KEY = "braindump_platform_secret";

function getSecret() {
  return sessionStorage.getItem(SECRET_KEY) || "";
}

function setSecret(value) {
  sessionStorage.setItem(SECRET_KEY, value);
}

function platformHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Platform-Secret": getSecret(),
  };
}

function showError(msg) {
  const el = document.getElementById("global-error");
  el.textContent = msg;
  el.hidden = !msg;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...platformHeaders(), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function showPanels() {
  document.getElementById("org-form-section").hidden = false;
  document.getElementById("invite-section").hidden = false;
  document.getElementById("list-section").hidden = false;
}

async function loadOrganizations() {
  const data = await api("/api/platform/organizations");
  const list = document.getElementById("org-list");
  const select = document.getElementById("invite-org-select");

  list.innerHTML = "";
  select.innerHTML = "";

  (data.organizations || []).forEach((org) => {
    const div = document.createElement("div");
    div.className = "org-item";
    div.innerHTML = `
      <strong>${org.name}</strong>
      <span>ID: ${org.id}</span><br />
      状態: ${org.status} / 階層: ${org.org_structure_depth ?? "未設定"}<br />
      ${org.postal_code || ""} ${org.address || ""}<br />
      TEL: ${org.phone || "—"}
    `;
    list.appendChild(div);

    const opt = document.createElement("option");
    opt.value = org.id;
    opt.textContent = `${org.name}（${org.status}）`;
    select.appendChild(opt);
  });

  if (!data.organizations?.length) {
    list.textContent = "登録された法人はまだありません。";
  }
}

document.getElementById("btn-save-secret").addEventListener("click", () => {
  const input = document.getElementById("platform-secret");
  const val = input.value.trim();
  if (!val) {
    showError("秘密鍵を入力してください");
    return;
  }
  setSecret(val);
  showError("");
  showPanels();
  loadOrganizations().catch((e) => showError(e.message));
});

document.getElementById("org-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  const fd = new FormData(e.target);
  const body = {
    name: fd.get("name"),
    postal_code: fd.get("postal_code") || undefined,
    address: fd.get("address") || undefined,
    phone: fd.get("phone") || undefined,
  };
  const repName = (fd.get("rep_name") || "").trim();
  if (repName) {
    body.representative = { display_name: repName };
  }

  try {
    const data = await api("/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const result = document.getElementById("org-result");
    result.hidden = false;
    result.textContent = JSON.stringify(data, null, 2);
    e.target.reset();
    await loadOrganizations();
  } catch (err) {
    showError(err.message);
  }
});

document.getElementById("invite-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  const organization_id = document.getElementById("invite-org-select").value;
  const display_name = document.getElementById("invite-rep-name").value.trim();

  try {
    const data = await api("/api/platform/invite-representative", {
      method: "POST",
      body: JSON.stringify({ organization_id, display_name }),
    });
    const result = document.getElementById("invite-result");
    result.hidden = false;
    result.textContent = JSON.stringify(data, null, 2);
    await loadOrganizations();
  } catch (err) {
    showError(err.message);
  }
});

document.getElementById("btn-refresh").addEventListener("click", () => {
  loadOrganizations().catch((e) => showError(e.message));
});

if (getSecret()) {
  document.getElementById("platform-secret").value = getSecret();
  showPanels();
  loadOrganizations().catch((e) => showError(e.message));
}
