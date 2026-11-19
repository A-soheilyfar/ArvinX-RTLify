const i18n = (key) => chrome.i18n.getMessage(key);

async function setBadge(tabId, on) {
  chrome.action.setBadgeText({ tabId, text: on ? "RTL" : "" }).catch(() => {});
  if (on)
    chrome.action
      .setBadgeBackgroundColor({ tabId, color: "#0a7d4f" })
      .catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "toggle-rtl",
    title: i18n("ctxMenuTitle"), // استفاده از متن ترجمه‌شده
    contexts: ["page", "frame", "selection"],
  });
});

async function toggleTab(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "toggle" });
    setBadge(tabId, res?.state);
    return res;
  } catch {
    return null;
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggle-rtl" && tab?.id) toggleTab(tab.id);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-rtl" && tab?.id) toggleTab(tab.id);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "getState" });
    setBadge(tabId, res?.state);
  } catch {
    setBadge(tabId, false);
  }
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== "complete") return;
  chrome.tabs.sendMessage(tabId, { type: "getState" }, (res) => {
    if (chrome.runtime.lastError) setBadge(tabId, false);
    else setBadge(tabId, res?.state);
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  const relevant =
    "settings" in changes ||
    Object.keys(changes).some((k) => k.startsWith("domainState:"));
  if (!relevant) return;
  chrome.tabs.query({}).then((tabs) => {
    for (const t of tabs) {
      if (!t.id) continue;
      chrome.tabs.sendMessage(t.id, { type: "applySettings" }).catch(() => {});
    }
  });
});
