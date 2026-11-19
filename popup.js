const i18n = (key) => chrome.i18n.getMessage(key);

// ست کردن جهت صفحه بر اساس زبان
const isFa = chrome.i18n.getUILanguage().startsWith("fa");
document.documentElement.dir = isFa ? "rtl" : "ltr";
document.documentElement.lang = isFa ? "fa" : "en";

// بارگذاری متن‌ها
function loadTranslations() {
  document.getElementById("smartTitle").textContent = i18n("smartModeTitle");
  document.getElementById("lblSmartOff").textContent = i18n("smartOff");
  document.getElementById("lblSmartSafe").textContent = i18n("smartSafe");
  document.getElementById("lblSmartAgg").textContent = i18n("smartAggressive");
  document.getElementById("lblAlign").textContent = i18n("chkAlign");
  document.getElementById("lblFont").textContent = i18n("chkFont");
  document.getElementById("lblGlobal").textContent = i18n("chkGlobal");
  document.getElementById("optionsBtn").textContent = i18n("btnOptions");
  document.getElementById("btnText").textContent = i18n("hostNA");
}

let tab = null;
let state = null;

const SMART_HINTS = {
  off: i18n("smartHintOff"),
  safe: i18n("smartHintSafe"),
  aggressive: i18n("smartHintAggressive"),
};

async function getActiveTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

function render() {
  const btn = document.getElementById("toggleBtn");
  const txt = document.getElementById("btnText");
  if (state === null) {
    txt.textContent = i18n("hostNA");
    btn.disabled = true;
    btn.classList.remove("on");
    return;
  }
  btn.disabled = false;
  txt.textContent = state ? i18n("toggleBtnOn") : i18n("toggleBtnOff");
  btn.classList.toggle("on", state);
}

function renderSmartHint(value) {
  document.getElementById("smartHint").textContent = SMART_HINTS[value] || "";
}

async function loadSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  document.getElementById("chkTextAlign").checked =
    settings?.textAlign ?? false;
  document.getElementById("chkFont").checked = settings?.fontFamily ?? false;
  document.getElementById("chkGlobal").checked =
    settings?.defaultGlobal ?? false;
  const mode = settings?.smartMode ?? "safe";
  document.querySelector(`input[name="smart"][value="${mode}"]`).checked = true;
  renderSmartHint(mode);
}

async function saveSettings(partial) {
  const { settings } = await chrome.storage.sync.get("settings");
  await chrome.storage.sync.set({
    settings: { ...(settings || {}), ...partial },
  });
}

async function init() {
  loadTranslations();
  tab = await getActiveTab();
  try {
    document.getElementById("host").textContent = tab?.url
      ? new URL(tab.url).hostname
      : "—";
  } catch {
    document.getElementById("host").textContent = "—";
  }

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "getState" });
    state = res.state;
  } catch {
    state = null;
  }
  render();
  await loadSettings();
}

// Event Listeners
document.getElementById("toggleBtn").addEventListener("click", async () => {
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
    state = res.state;
    render();
  } catch {}
});

document.querySelectorAll('input[name="smart"]').forEach((r) => {
  r.addEventListener("change", async (e) => {
    if (!e.target.checked) return;
    await saveSettings({ smartMode: e.target.value });
    renderSmartHint(e.target.value);
  });
});

document
  .getElementById("chkTextAlign")
  .addEventListener(
    "change",
    async (e) => await saveSettings({ textAlign: e.target.checked }),
  );
document.getElementById("chkFont").addEventListener(
  "change",
  async (e) =>
    await saveSettings({
      fontFamily: e.target.checked
        ? '"Vazirmatn", "Segoe UI", Tahoma, sans-serif'
        : false,
    }),
);
document
  .getElementById("chkGlobal")
  .addEventListener(
    "change",
    async (e) => await saveSettings({ defaultGlobal: e.target.checked }),
  );
document
  .getElementById("optionsBtn")
  .addEventListener("click", () => chrome.runtime.openOptionsPage());

init();
