let tab = null;
let state = null;

async function getActiveTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

function render() {
  const btn = document.getElementById("toggleBtn");
  const txt = document.getElementById("btnText");
  if (state === null) {
    txt.textContent = "در این صفحه قابل استفاده نیست";
    btn.disabled = true;
    btn.classList.remove("on");
    return;
  }
  btn.disabled = false;
  txt.textContent = state ? "غیرفعال‌سازی RTL" : "فعال‌سازی RTL";
  btn.classList.toggle("on", state);
}

async function loadSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  document.getElementById("chkTextAlign").checked =
    settings?.textAlign ?? false;
  document.getElementById("chkFont").checked = settings?.fontFamily ?? false;
}

async function init() {
  tab = await getActiveTab();
  document.getElementById("host").textContent = tab?.url
    ? new URL(tab.url).hostname
    : "—";
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "getState" });
    state = res.state;
  } catch {
    state = null;
  }
  render();
  await loadSettings();
}

document.getElementById("toggleBtn").addEventListener("click", async () => {
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
    state = res.state;
    render();
  } catch (e) {
    document.getElementById("info").textContent = "خطا در ارتباط با صفحه";
  }
});

async function saveAndApply() {
  const settings = {
    textAlign: document.getElementById("chkTextAlign").checked,
    fontFamily: document.getElementById("chkFont").checked
      ? '"Vazirmatn", "Segoe UI", Tahoma, sans-serif'
      : false,
  };
  await chrome.storage.sync.set({ settings });
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "applySettings" });
  } catch {}
}

document
  .getElementById("chkTextAlign")
  .addEventListener("change", saveAndApply);
document.getElementById("chkFont").addEventListener("change", saveAndApply);
document
  .getElementById("optionsBtn")
  .addEventListener("click", () => chrome.runtime.openOptionsPage());

init();
