const i18n = (key) => chrome.i18n.getMessage(key);
const isFa = chrome.i18n.getUILanguage().startsWith("fa");
document.documentElement.dir = isFa ? "rtl" : "ltr";
document.documentElement.lang = isFa ? "fa" : "en";

const PREFIX = "domainState:";

function loadTranslations() {
  document.title = i18n("optTitle");
  document.getElementById("optTitle").textContent = i18n("optTitle");
  document.getElementById("optGlobalTitle").textContent =
    i18n("optGlobalTitle");
  document.getElementById("optGlobalDesc").textContent = i18n("optGlobalDesc");
  document.getElementById("lblGlobal").textContent = i18n("chkGlobal");
  document.getElementById("optDomainsTitle").textContent =
    i18n("optDomainsTitle");
  document.getElementById("empty").textContent = i18n("optEmpty");
  document.getElementById("clear").textContent = i18n("optClearAll");
  document.getElementById("optBackupTitle").textContent =
    i18n("optBackupTitle");
  document.getElementById("export").textContent = i18n("optExport");
}

async function loadGlobal() {
  const { settings } = await chrome.storage.sync.get("settings");
  document.getElementById("chkGlobal").checked =
    settings?.defaultGlobal ?? false;
}

async function loadDomains() {
  const all = await chrome.storage.sync.get(null);
  const entries = Object.entries(all)
    .filter(([k]) => k.startsWith(PREFIX))
    .map(([k, v]) => ({ host: k.slice(PREFIX.length), state: v }))
    .sort((a, b) => a.host.localeCompare(b.host));

  const ul = document.getElementById("domains");
  ul.innerHTML = "";
  document.getElementById("empty").style.display = entries.length
    ? "none"
    : "block";

  for (const { host, state } of entries) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "domain";
    span.textContent = host;

    const badge = document.createElement("span");
    badge.className = "state " + state;
    badge.textContent = state === "on" ? "RTL" : "LTR";

    const btn = document.createElement("button");
    btn.textContent = i18n("optDeleteBtn");
    btn.onclick = async () => {
      await chrome.storage.sync.remove(PREFIX + host);
      loadDomains();
    };

    li.append(span, badge, btn);
    ul.appendChild(li);
  }
}

document.getElementById("chkGlobal").addEventListener("change", async (e) => {
  const { settings } = await chrome.storage.sync.get("settings");
  await chrome.storage.sync.set({
    settings: { ...(settings || {}), defaultGlobal: e.target.checked },
  });
});

document.getElementById("clear").addEventListener("click", async () => {
  if (!confirm(i18n("optConfirmClear"))) return;
  const all = await chrome.storage.sync.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(PREFIX));
  await chrome.storage.sync.remove(keys);
  loadDomains();
});

document.getElementById("export").addEventListener("click", async () => {
  const all = await chrome.storage.sync.get(null);
  const blob = new Blob([JSON.stringify(all, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rtl-toggle-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const msg = document.getElementById("importMsg");
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    await chrome.storage.sync.set(data);
    msg.textContent = i18n("optImported");
    loadGlobal();
    loadDomains();
  } catch (err) {
    msg.textContent = i18n("optInvalidFile") + err.message;
  }
});

loadTranslations();
loadGlobal();
loadDomains();
