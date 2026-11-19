/* RTL Toggle — سرویس‌ورکر کروم (Manifest V3) */

const STATE_KEY = "rtlTabs";

async function getState() {
  const { [STATE_KEY]: s } = await chrome.storage.session.get(STATE_KEY);
  return s || {};
}

async function setState(state) {
  await chrome.storage.session.set({ [STATE_KEY]: state });
}

function setBadge(tabId, on) {
  chrome.action.setBadgeText({ tabId, text: on ? "RTL" : "" }).catch(() => {});
  if (on) {
    chrome.action
      .setBadgeBackgroundColor({ tabId, color: "#0a7d4f" })
      .catch(() => {});
  }
}

/* این تابع در صفحه تزریق می‌شود — نباید به متغیر بیرونی وابسته باشد */
function toggleRTL() {
  const STYLE_ID = "__rtl_toggle_style__";
  const FLAG = "data-rtl-toggle";
  const html = document.documentElement;

  // خاموش کردن
  if (html.hasAttribute(FLAG)) {
    document.getElementById(STYLE_ID)?.remove();
    html.removeAttribute(FLAG);
    const orig = html.getAttribute("data-rtl-orig-dir");
    if (orig === null || orig === "") html.removeAttribute("dir");
    else html.setAttribute("dir", orig);
    html.removeAttribute("data-rtl-orig-dir");
    return false;
  }

  // روشن کردن
  html.setAttribute("data-rtl-orig-dir", html.getAttribute("dir") ?? "");
  html.setAttribute("dir", "rtl");
  html.setAttribute(FLAG, "");

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html, body { direction: rtl !important; }
      body * { direction: rtl !important; }
      pre, code, kbd, samp {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: embed;
      }
      input[type="url"], input[type="email"], input[type="tel"],
      input[type="password"], input[type="number"] {
        direction: ltr !important;
        text-align: left !important;
      }
    `;
    (document.head || html).appendChild(style);
  }
  return true;
}

/* کلیک روی آیکن */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleRTL,
    });
    const isOn = Boolean(res?.result);
    const state = await getState();
    if (isOn) state[tab.id] = true;
    else delete state[tab.id];
    await setState(state);
    setBadge(tab.id, isOn);
  } catch (err) {
    // صفحات chrome://، Web Store و PDF قابل تزریق نیستند
    console.warn("RTL Toggle:", err);
    chrome.action.setBadgeText({ tabId: tab.id, text: "✕" }).catch(() => {});
    setTimeout(
      () =>
        chrome.action.setBadgeText({ tabId: tab.id, text: "" }).catch(() => {}),
      1500,
    );
  }
});

/* پاک‌سازی وضعیت هنگام بستن تب */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state[tabId]) {
    delete state[tabId];
    await setState(state);
  }
});

/* پاک‌سازی هنگام ناوبری */
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== "loading") return;
  const state = await getState();
  if (state[tabId]) {
    delete state[tabId];
    await setState(state);
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  }
});

/* بازیابی نشان با سوئیچ بین تب‌ها */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const state = await getState();
  setBadge(tabId, Boolean(state[tabId]));
});
